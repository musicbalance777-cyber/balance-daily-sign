"""BALANCE v32: static app + Telegram-verified daily letters, Python stdlib only."""
import hashlib
import hmac
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qsl
from zoneinfo import ZoneInfo
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get('BALANCE_DB_PATH', str(ROOT / 'server' / 'balance.sqlite3')))
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
DEV_MODE = os.environ.get('BALANCE_DEV_MODE', '') == '1'
PORT = int(os.environ.get('PORT', '8005'))

# Keep message texts in the existing JS library; parse its simple string arrays once.
# v32 stores stable message snapshots, so later changes won't alter issued letters.
import re
MESSAGES_SOURCE = (ROOT / 'data' / 'messages.js').read_text(encoding='utf-8')
MESSAGES = {}
for category in ('important', 'pleasant', 'unexpected'):
    match = re.search(r'"' + category + r'"\s*:\s*\[([\s\S]*?)\]', MESSAGES_SOURCE)
    if not match:
        raise RuntimeError('Missing message category: ' + category)
    # Strings are double-quoted in the existing source; decode JS escapes via JSON.
    strings = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    MESSAGES[category] = [json.loads(s) for s in strings]
    if not MESSAGES[category]:
        raise RuntimeError('Empty category: ' + category)


def day_key():
    return datetime.now(ZoneInfo('Europe/Kyiv')).strftime('%Y-%m-%d')


def validate_init_data(raw):
    if not BOT_TOKEN or not isinstance(raw, str) or len(raw) > 8192:
        return None
    try:
        pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=True)
        values = dict(pairs)
        if len(values) != len(pairs) or 'hash' not in values:
            return None
        auth_date = int(values['auth_date'])
        now = int(datetime.now().timestamp())
        if auth_date > now + 60 or now - auth_date > 86400:
            return None
        data_check = '\n'.join(f'{k}={v}' for k, v in sorted(values.items()) if k != 'hash')
        secret = hmac.new(b'WebAppData', BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, values['hash']):
            return None
        user_id = json.loads(values['user'])['id']
        if not isinstance(user_id, int) or user_id <= 0:
            return None
        return str(user_id)
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        return None


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('''CREATE TABLE IF NOT EXISTS daily_letters (
        user_id TEXT NOT NULL, day_key TEXT NOT NULL, category TEXT NOT NULL,
        message_text TEXT NOT NULL, PRIMARY KEY(user_id, day_key, category)
    )''')
    return conn


def daily_letters(user_id):
    day = day_key()
    conn = connect()
    try:
        conn.execute('BEGIN IMMEDIATE')
        for category, texts in MESSAGES.items():
            # Deterministic per-user order, cycling through the full category library.
            digest = hashlib.sha256(f'balance-v32|{user_id}|{category}'.encode()).digest()
            offset = int.from_bytes(digest[:8], 'big') % len(texts)
            serial = (datetime.strptime(day, '%Y-%m-%d').date() - datetime(1970, 1, 1).date()).days
            selected = texts[(offset + serial) % len(texts)]
            conn.execute('''INSERT OR IGNORE INTO daily_letters
                (user_id, day_key, category, message_text) VALUES (?, ?, ?, ?)''',
                (user_id, day, category, selected))
        rows = conn.execute('SELECT category, message_text FROM daily_letters WHERE user_id=? AND day_key=?',
                            (user_id, day)).fetchall()
        conn.commit()
        return {'dayKey': day, 'letters': {cat: {'category': cat, 'dayKey': day, 'text': txt}
                                         for cat, txt in rows}}
    finally:
        conn.close()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != '/api/daily-letters':
            self.send_error(404)
            return
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            self.respond(415, {'error': 'Expected JSON'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16384:
                self.respond(413, {'error': 'Invalid request size'})
                return
            payload = json.loads(self.rfile.read(length))
            user_id = validate_init_data(payload.get('initData'))
            if user_id is None:
                if DEV_MODE and self.client_address[0] in ('127.0.0.1', '::1') and not payload.get('initData'):
                    user_id = 'dev:local-preview'
                else:
                    self.respond(401, {'error': 'Telegram authentication required'})
                    return
            self.respond(200, daily_letters(user_id))
        except (ValueError, TypeError, json.JSONDecodeError):
            self.respond(400, {'error': 'Invalid request'})
        except Exception:
            self.respond(500, {'error': 'Server error'})

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect():
        pass
    print(f'BALANCE v32 serving on http://localhost:{PORT} | dev={DEV_MODE}', flush=True)
    ThreadingHTTPServer(('127.0.0.1' if DEV_MODE else '0.0.0.0', PORT), Handler).serve_forever()
