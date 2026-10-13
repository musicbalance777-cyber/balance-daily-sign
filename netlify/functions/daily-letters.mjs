import crypto from 'node:crypto';
import messages from '../../data/messages.json' with { type: 'json' };

const categories = ['important', 'pleasant', 'unexpected'];
const reply = (statusCode, data) => ({statusCode, headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff'}, body: JSON.stringify(data)});

function verifiedTelegramUser(initData, token, nowSeconds = Math.floor(Date.now()/1000)) {
  if (!token || typeof initData !== 'string' || !initData || initData.length > 8192) return null;
  try {
    const params = new URLSearchParams(initData);
    const entries = [...params.entries()];
    if (new Set(entries.map(([k]) => k)).size !== entries.length) return null;
    const hash = params.get('hash');
    const authDate = Number(params.get('auth_date'));
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(authDate) || authDate > nowSeconds+60 || nowSeconds-authDate > 86400) return null;
    const checkString = entries.filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>`${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256','WebAppData').update(token).digest();
    const expected = crypto.createHmac('sha256',secret).update(checkString).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(hash,'hex'))) return null;
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return String(user.id);
  } catch { return null; }
}

function kyivDay() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function selectText(userId, day, category) {
  const texts = messages[category];
  const hash = crypto.createHash('sha256').update(`balance-v32|${userId}|${category}`).digest();
  const offset = Number(hash.readBigUInt64BE(0) % BigInt(texts.length));
  const serial = Math.floor(Date.parse(`${day}T00:00:00Z`)/86400000);
  return texts[(offset + serial) % texts.length];
}
async function dbRequest(url, key, path, {method='GET', body, prefer}={}) {
  const res = await fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`, {
    method,
    headers:{'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json', ...(prefer ? {'Prefer':prefer}:{})},
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  if (!res.ok) throw new Error(`Database request failed: ${res.status}`);
  const responseText = await res.text(); return responseText.trim() ? JSON.parse(responseText) : null;
}
export async function handler(event) {
  if (event.httpMethod !== 'POST') return reply(405,{error:'Method not allowed'});
  if (!(event.headers['content-type']||'').toLowerCase().startsWith('application/json')) return reply(415,{error:'Expected JSON'});
  if (!event.body || event.body.length > 16384) return reply(413,{error:'Invalid request size'});
  const { TELEGRAM_BOT_TOKEN: token, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!token || !url || !key) return reply(503,{error:'Service not configured'});
  let payload;
  try {payload = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body,'base64').toString('utf8') : event.body);} catch {return reply(400,{error:'Invalid JSON'});}
  const userId = verifiedTelegramUser(payload?.initData,token);
  if (!userId) return reply(401,{error:'Telegram authentication required'});
  const day = kyivDay();
  try {
    const rows = categories.map(category=>({user_id:userId,day_key:day,category,message_text:selectText(userId,day,category)}));
    // Unique key guarantees that concurrent requests never overwrite already-issued texts.
    await dbRequest(url,key,'daily_letters?on_conflict=user_id,day_key,category',{method:'POST',body:rows,prefer:'resolution=ignore-duplicates,return=minimal'});
    const saved = await dbRequest(url,key,`daily_letters?user_id=eq.${encodeURIComponent(userId)}&day_key=eq.${day}&select=category,message_text`);
    if (!Array.isArray(saved) || saved.length !== 3 || !categories.every(c=>saved.some(r=>r.category===c))) throw new Error('Incomplete saved letters');
    return reply(200,{dayKey:day,letters:Object.fromEntries(saved.map(r=>[r.category,{category:r.category,dayKey:day,text:r.message_text}]))});
  } catch (err) { console.error('Daily letters database error:',err.message); return reply(503,{error:'Letters temporarily unavailable'}); }
}
export const __test = { verifiedTelegramUser, kyivDay, selectText };
