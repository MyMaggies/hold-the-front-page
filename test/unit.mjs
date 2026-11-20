import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { MAP, CFG, step, solid, MODES, MODE_KEYS } from '../public/shared.js';
const mk = (n = 4, level = 1, mode) => new Game({ level, mode, roster: Array.from({ length: n }, (_, i) => ({ id: i, name: 'P' + i, color: '#fff', team: i % 2 })), seed: 7, rules: { fog: true } });
const run = (g, secs) => { for (let i = 0; i < secs * 20; i++) g.update(0.05); };
const park = (g) => { g.floor.length = 0; g.pups.length = 0; g.rules.cardsOnMap = 0; g.rules.powerMax = 0; };   // nothing new spawns
const card = (u, c = 'F') => ({ u, card: { t: 'card ' + u, c, w: 'why', lv: 1 } });

// 1. raid portal: one way, once, no cards, cooldown
{ const g = mk(); park(g); const p = g.players[0]; p.x = 31.5; p.y = 1.5; g.update(0.05);
  assert.ok(Math.abs(p.x - 52.5) < 0.01 && Math.abs(p.y - 1.5) < 0.01, 'raid moved player into enemy duct'); assert.ok(p.raidCd > 10, 'cooldown started'); g.update(0.05); assert.ok(Math.abs(p.x - 52.5) < 0.01, 'no bounce back');
  const q = g.players[2]; q.x = 31.5; q.y = 1.5; q.carry = card(1); g.update(0.05); assert.ok(Math.abs(q.x - 31.5) < 0.01, 'cannot take a card through');
  const r = g.players[0]; r.x = 31.5; r.y = 1.5; r.tubeLock = false; g.update(0.05); assert.ok(Math.abs(r.x - 31.5) < 0.01, 'cooldown blocks second raid');
  assert.ok(g.events.some((e) => e.k === 'raidno'), 'tells the player why'); 
  const g4 = mk(); park(g4); const t = g4.players[0]; t.x = 4.5; t.y = 4.5; g4.update(0.05); assert.ok(Math.abs(t.x - 66.5) < 0.01 && Math.abs(t.y - 4.5) < 0.01, 'room portal lands behind the enemy desk F');
  console.log('raid ok'); }
// 2. hiding: invisible to enemies until they come very close
{ const g = mk(); park(g); const p = g.players[0], e = g.players[1]; p.x = 3.5; p.y = 3.5; e.x = 3.5; e.y = 7.5;
  run(g, 1); assert.equal(p.hide, true, 'hidden'); let seen = g.visibleTo(e); assert.equal(seen.has(0), false, 'enemy at 4 tiles cannot see hidden player');
  e.x = 3.5; e.y = 4.6; seen = g.visibleTo(e); assert.equal(seen.has(0), true, 'enemy up close finds hidden player'); console.log('hide ok'); }
// 3. a free player WITHOUT a card steals from a carrier and ties them up
{ const g = mk(); park(g); const a = g.players[0], b = g.players[1]; a.x = 28.5; a.y = 6.5; b.x = 29.2; b.y = 6.5;
  a.carry = card(99); g.update(0.05);
  assert.equal(a.carry, null, 'victim lost card'); assert.equal(a.tied, true, 'victim tied'); assert.ok(b.carry && b.carry.u === 99, 'thief holds the stolen card'); assert.equal(b.tags, 1);
  // tied players cannot move, and cannot be tagged again
  g.setInput(0, 1, 0); const x0 = a.x; run(g, 1); assert.equal(a.x, x0, 'tied player stays put');
  // thief is protected for a moment, so the first player's team mate can't instantly re-steal
  const g2 = mk(); park(g2); const c = g2.players[0], d = g2.players[1]; c.x = 28.5; c.y = 6.5; d.x = 29.2; d.y = 6.5;
  c.carry = card(1); d.carry = card(2); g2.update(0.05); assert.ok(c.carry && d.carry && !c.tied, 'both carrying: nobody is tagged'); console.log('steal ok'); }
// 4. rescue: a free teammate touching a tied player frees them (no timer)
{ const g = mk(6); park(g); const a = g.players[0], mate = g.players[2], foe = g.players[1]; a.x = 28.5; a.y = 6.5; foe.x = 29.2; foe.y = 6.5; mate.x = 17.5; mate.y = 22.5;
  a.carry = card(5); g.update(0.05); assert.equal(a.tied, true);
  run(g, 10); assert.equal(a.tied, true, 'still tied after 10 seconds');
  mate.x = a.x + 0.5; mate.y = a.y; g.update(0.05); assert.equal(a.tied, false, 'freed by teammate'); assert.equal(mate.saves, 1); assert.ok(a.grace > 0, 'grace after rescue');
  // an enemy cannot rescue
  const g2 = mk(6); park(g2); const t = g2.players[0], e = g2.players[1]; t.tied = true; t.tiedT = 15; t.x = 28.5; t.y = 6.5; e.x = 28.9; e.y = 6.5; g2.update(0.05); assert.equal(t.tied, true, 'enemy cannot free you'); console.log('rescue ok'); }
// 5. tied up: break free alone after 15 seconds, or sooner with SNIP
{ const g = mk(4); park(g); const a = g.players[0]; a.tied = true; a.tiedT = CFG.tiedSecs; run(g, 14); assert.equal(a.tied, true, 'still tied at 14s'); run(g, 1.2); assert.equal(a.tied, false, 'free after 15s'); assert.ok(g.events.some((e) => e.k === 'free' && e.self));
  const g2 = mk(4); park(g2); const b = g2.players[0]; b.tied = true; b.tiedT = CFG.tiedSecs; b.powers = ['B']; g2.usePower(0, 0); assert.ok(b.tiedT <= CFG.tiedSecs - CFG.snipSecs + 0.01, 'snip took time off'); run(g2, 7.5); assert.equal(b.tied, false, 'free sooner with snip');
  const g3 = mk(4); park(g3); const c = g3.players[0]; c.powers = ['B']; g3.usePower(0, 0); assert.equal(c.powers.length, 1, 'snip not wasted when not tied'); console.log('tied timer + snip ok'); }
// 6. SHIELD absorbs one tag and stuns the tagger
{ const g = mk(); park(g); const a = g.players[0], b = g.players[1]; a.x = 28.5; a.y = 6.5; b.x = 29.2; b.y = 6.5; a.carry = card(3); a.powers = ['H']; g.usePower(0, 0);
  g.update(0.05); assert.ok(a.carry && !a.tied, 'shield held'); assert.ok(b.stun > 0.5, 'tagger stunned'); assert.equal(a.shieldT, 0); console.log('shield ok'); }
// 7. SPRINT is faster, runs out, powers can be picked up from the floor (up to the limit)
{ const g = mk(); park(g); const a = g.players[0]; a.powers = ['S']; a.x = 9.5; a.y = 1.5; g.setInput(0, 1, 0); const y0 = a.x; run(g, 1); const normal = a.x - y0;
  a.x = 9.5; a.y = 1.5; g.usePower(0, 0); const y1 = a.x; run(g, 1); const fast = a.x - y1; assert.ok(fast > normal * 1.4, `sprint faster (${fast.toFixed(2)} vs ${normal.toFixed(2)})`);
  run(g, 3); assert.equal(a.sprintT <= 0, true); g.setInput(0, 0, 0);
  assert.equal(a.powers.length, 0); g.pups.push({ u: 50, kind: 'H', x: a.x, y: a.y }); g.update(0.05); assert.deepEqual(a.powers, ['H'], 'picked up shield');
  a.powers = ['S', 'S', 'S', 'S', 'S', 'S', 'S']; g.pups.push({ u: 51, kind: 'Z', x: a.x, y: a.y }); g.update(0.05); assert.equal(a.powers.length, 7, 'full: cannot pick up more'); console.log('powers ok'); }
// 7b. start kit, BLAST and RADAR
{ const g = mk(6); for (const p of g.players) assert.equal(p.powers.length, 5, 'five powers each'); assert.deepEqual(g.players[0].powers, ['S', 'S', 'S', 'Z', 'N'], 'attacker kit'); const gd = new Game({ level: 1, roster: [{ id: 0, name: 'a', color: '#fff', team: 0, role: 'D' }, { id: 1, name: 'b', color: '#fff', team: 1 }], seed: 3 }); assert.deepEqual(gd.players[0].powers, ['S', 'S', 'S', 'H', 'B'], 'defender kit'); const a = g.players[0], e = g.players[1];
  park(g); a.x = 28.5; a.y = 6.5; e.x = 29.5; e.y = 6.5; a.powers = ['Z']; g.usePower(0, 0); assert.ok(e.freeze > 2, 'enemy frozen'); const ex = e.x; g.setInput(1, 1, 0); run(g, 1); assert.equal(e.x, ex, 'frozen enemy cannot move');
  const g2 = mk(6); park(g2); const r = g2.players[0], far = g2.players[1]; far.x = 60.5; far.y = 17.5; r.x = 5.5; r.y = 15.5; assert.equal(g2.visibleTo(r).has(1), false, 'far enemy hidden'); r.powers = ['R']; g2.usePower(0, 0); assert.equal(g2.visibleTo(r).has(1), true, 'radar shows enemy'); run(g2, CFG.radarSecs + 0.5); assert.equal(g2.visibleTo(r).has(1), false, 'radar ends'); console.log('blast + radar ok'); }
// 8. correct and wrong delivery
{ const g = mk(); park(g); const a = g.players[0]; const desk = MAP.desks.find((d) => d.team === 0 && d.kind === 'F');
  a.x = desk.x0 + 1; a.y = desk.y0 + 1; a.carry = card(1); g.update(0.05); assert.deepEqual(g.score, [1, 0]);
  const dO = MAP.desks.find((d) => d.team === 0 && d.kind === 'O'); a.x = dO.x0 + 1; a.y = dO.y0 + 1; a.carry = card(2); g.update(0.05);
  assert.deepEqual(g.score, [1, 0]); assert.ok(a.stun > 2); assert.equal(g.mistakes.length, 1);
  const eD = MAP.desks.find((d) => d.team === 1 && d.kind === 'F'); const b = g.players[0]; b.stun = 0; b.x = eD.x0 + 1; b.y = eD.y0 + 1; b.carry = card(3); g.update(0.05); assert.ok(b.carry, 'enemy desk ignored'); console.log('deliver ok'); }
// 9. modes: four desks exist; each mode opens the right ones; decks only draw that bank
{ assert.deepEqual(MAP.desks.map((d) => d.kind).sort(), ['F', 'F', 'I', 'I', 'L', 'L', 'O', 'O'], 'four desks per team');
  const want = { fo: 2, tb: 2, d1: 4, d2: 4 };
  for (const m of MODE_KEYS) { const g = mk(4, 1, m); assert.equal(g.kinds.length, want[m], m + ' kinds');
    const seen = new Set(); for (let i = 0; i < 400; i++) { const c = g.deck.draw ? g.deck.draw() : g.deck.next(); seen.add(c.c); assert.ok(g.kinds.includes(c.c), m + ' draws only open desks'); }
    assert.equal(seen.size, g.kinds.length, m + ' uses every desk');
    for (const k of g.kinds) assert.ok(MODES[m].names[k] && MODES[m].names[k].name, m + ' names ' + k); }
  for (const m of MODE_KEYS) { const g = mk(4, 1, m); park(g); const a = g.players[0]; const closed = ['F','O','I','L'].find((k) => !g.kinds.includes(k));
    if (closed) { const d = MAP.desks.find((x) => x.team === 0 && x.kind === closed); a.x = d.x0 + 1; a.y = d.y0 + 1; a.carry = { id: 99, c: closed, t: 'x', w: '' }; g.update(0.05); assert.ok(a.carry, m + ' closed desk ignores card'); } }
  console.log('modes ok'); }
// 10. drop and re-pickup lock
{ const g = mk(); park(g); const a = g.players[0]; a.x = 28.5; a.y = 6.5; a.carry = card(5); g.drop(0); assert.equal(a.carry, null); g.update(0.05); assert.equal(a.carry, null, 'locked'); run(g, 1.6); assert.ok(a.carry, 'picked up again'); console.log('drop ok'); }
// 11. walls block movement; desk F is a dead-end alcove at the east end of the stationery room
{ const p = { x: 9.5, y: 3.5 }; for (let i = 0; i < 100; i++) step(p, 1, 0, 0.05, 3.6); assert.ok(p.x > 11.5 && p.x <= 11.7, 'stopped by the back wall of the alcove');
  for (let i = 0; i < 100; i++) step(p, 0, -1, 0.05, 3.6); assert.ok(p.y >= 3.3 && p.y < 3.5, 'stopped by the alcove wall'); console.log('walls ok'); }
// 11b. no sticking: sliding along walls and round a pillar corner, and never ending up inside a wall
{ const p = { x: 13.6, y: 9.6 }; for (let i = 0; i < 40; i++) step(p, 1, 1, 0.05, 3.6); assert.ok(p.x > 14.5 || p.y > 11, 'slides round the corner of a pillar instead of sticking');
  const q = { x: 13.5, y: 9.5 }; const q0 = { ...q }; for (let i = 0; i < 20; i++) step(q, 0.3, 1, 0.05, 3.6); assert.ok(q.y > q0.y + 1.5, 'slides down along a wall when pushing at it');
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let bad = 0;
  for (let n = 0; n < 300; n++) { const r = { x: 12.5 + rnd() * 12, y: 8.5 + rnd() * 9 }; if (solid(Math.floor(r.x), Math.floor(r.y))) continue; const ang = rnd() * 6.28; for (let i = 0; i < 80; i++) { step(r, Math.cos(ang + i * 0.05), Math.sin(ang + i * 0.05), 0.05, 5.76); if (solid(Math.floor(r.x), Math.floor(r.y))) bad++; } }
  assert.equal(bad, 0, 'never inside a wall'); console.log('no sticking ok'); }
// 12. snapshots: no card classes, power-ups and tied flags present
{ const g = mk(); const a = g.players[0]; g.floor[0].x = a.x; g.floor[0].y = a.y; g.update(0.05);
  const s0 = JSON.stringify(g.snapshot(0)), s1 = JSON.stringify(g.snapshot(1)); assert.ok(!/"c":"[FOIL]"/.test(s0 + s1));
  const mine = g.snapshot(0).p.find((q) => q.i === 0); assert.ok(mine.ct, 'carrier reads own card'); assert.deepEqual(mine.pw.slice(0, 3), ['S', 'S', 'S'], 'starts with three sprints'); assert.ok(Array.isArray(g.snapshot(0).pu)); console.log('snapshot ok'); }
// 12b. fog off (the default): everyone sees the whole map, except hidden players
{ const g = new Game({ level: 1, roster: [0, 1, 2, 3].map((i) => ({ id: i, name: 'P' + i, color: '#fff', team: i % 2 })), seed: 3 });
  const a = g.players[0], far = g.players[1]; far.x = 60.5; far.y = 17.5; a.x = 5.5; a.y = 15.5; assert.equal(g.visibleTo(a).has(1), true, 'no fog: far enemy visible'); far.hide = true; assert.equal(g.visibleTo(a).has(1), false, 'hidden still hidden');
  assert.ok(g.snapshot(0).cards.length >= 3, 'no fog: all cards visible'); console.log('fog off ok'); }
// 12c. captain vote, NET power, middle-line raid portal
{ const g = mk(6); const t0 = g.players.filter((q) => q.team === 0), t1 = g.players.filter((q) => q.team === 1);
  g.vote(t0[0].id, t0[2].id); g.vote(t0[1].id, t0[2].id); g.vote(t0[2].id, t0[1].id); g.vote(t0[0].id, t1[0].id);   // last one is ignored (other team)
  const vi = g.voteInfo(t0[0].id); assert.equal(vi.tally[t0[2].id], 2, 'two votes'); g.pickCaptains();
  assert.equal(g.captain[0], t0[2].id, 'most votes wins'); assert.equal(t0[2].powers.filter((c) => c === 'R').length, 5, 'captain has 5 radars'); assert.equal(t0[0].powers.includes('R'), false, 'others have none'); assert.ok(g.captain[1] >= 0, 'other team gets a captain too');
  const g2 = mk(4); park(g2); const a = g2.players[0], e = g2.players[1]; a.x = 27.5; a.y = 12.5; e.x = 31.5; e.y = 12.5; a.powers = ['N']; g2.usePower(0, 0); assert.ok(e.freeze > 2, 'netted'); assert.equal(a.powers.length, 0, 'net consumed');
  a.powers = ['N']; e.freeze = 0; e.x = 60.5; g2.usePower(0, 0); assert.equal(a.powers.length, 1, 'net not wasted with no target in range');
  const mid = MAP.tubes.find((t) => t.x === 34 && t.y === 13); assert.ok(mid && mid.raid, 'middle portal exists'); assert.equal(solid(mid.to[0], mid.to[1]), false);
  console.log('captain + net + middle portal ok'); }
// 13. pings: every spawn pings everybody; far-away cards are hidden by fog
{ const g = mk(6); g.events.length = 0; g.floor.length = 0; g.spawnT = 0; g.rules.cardsOnMap = 3; g.update(0.05);
  const ping = g.events.find((e) => e.k === 'ping'); assert.ok(ping, 'ping on spawn'); assert.ok(!('c' in ping) && !('t' in ping), 'ping carries no card info');
  const s0 = g.snapshot(0), s1 = g.snapshot(1); assert.ok(s0.ev.some((e) => e.k === 'ping') && s1.ev.some((e) => e.k === 'ping'), 'both teams get the ping');
  assert.equal(s0.cards.length, 0, 'card in the middle is not visible from the base'); const p0 = g.players[0]; p0.x = ping.x - 1; p0.y = ping.y; assert.equal(g.snapshot(0).cards.length >= 1, true, 'visible when you walk up'); console.log('ping ok'); }
// 14. explore warm-up: free movement, no cards or tags, then everyone is reset and the match begins
{ const g = new Game({ level: 1, roster: Array.from({ length: 4 }, (_, i) => ({ id: i, name: 'P' + i, color: '#fff', team: i % 2 })), seed: 5, rules: { exploreSecs: 30 } });
  assert.equal(g.floor.length, 0, 'no cards during warm-up'); const a = g.players[0], start = [a.x, a.y]; g.setInput(0, 1, 0); run(g, 3); assert.ok(a.x > start[0] + 5, 'can walk about'); g.usePower(0, 0); assert.equal(a.powers.length, 5, 'no powers in warm-up');
  assert.equal(g.snapshot(0).p[0].ex > 20, true, 'snapshot says how long is left'); run(g, 28); assert.ok(g.exploreT <= 0 && g.floor.length > 0, 'match begins with cards'); assert.ok(Math.abs(a.x - start[0]) < 0.01, 'players are back at their start spots'); console.log('explore ok'); }
console.log('ALL OK');
