import assert from 'node:assert/strict';
import { dailyMessage, dailyCollection, kyivDayKey } from '../scripts/daily-selection.mjs';
const id='test-installation';
const a=dailyCollection({localId:id,dayKey:'2026-10-12'});
const b=dailyCollection({localId:id,dayKey:'2026-10-12'});
assert.deepEqual(a,b,'same day and user must be stable');
assert.equal(Object.keys(a).length,3);
for(const category of Object.keys(a)) {
  const first=dailyMessage({category,localId:id,dayKey:'2026-10-12'});
  const next=dailyMessage({category,localId:id,dayKey:'2026-10-13'});
  assert.notEqual(first.text,next.text,'adjacent days must differ');
  const seen=new Set();
  for(let day=1;day<=12;day++) seen.add(dailyMessage({category,localId:id,dayKey:`2026-10-${String(day).padStart(2,'0')}`}).text);
  assert.equal(seen.size,12,'cycle should cover each text once');
}
assert.equal(kyivDayKey(new Date('2026-10-11T20:59:00Z')),'2026-10-11');
assert.equal(kyivDayKey(new Date('2026-10-11T21:00:00Z')),'2026-10-12');
console.log('All BALANCE daily-selection tests passed.');
