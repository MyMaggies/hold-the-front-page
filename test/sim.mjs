import { Game } from '../src/game.js';
import { Bot } from './bots.mjs';
function run(n, level, seed) {
  const roster = []; for (let i = 0; i < n; i++) roster.push({ id: i, name: 'B' + i, color: '#fff', team: i % 2 });
  const g = new Game({ mode: level, roster, seed, rules: { cardsOnMap: 3, winScore: n >= 9 ? 20 : n >= 7 ? 17 : 14, maxTime: 540 } });
  const bots = roster.map((r) => new Bot(g, r.id, "normal"));
  const ev = {}; let maxSnap = 0, ticks = 0;
  while (!g.over && ticks < 20 * 400) {
    for (const b of bots) b.tick(0.05);
    g.update(0.05); ticks++;
    if (ticks % 2 === 0) for (let i = 0; i < n; i++) { const s = JSON.stringify(g.snapshot(i)); maxSnap = Math.max(maxSnap, s.length); }
    for (const e of g.events.splice(0)) ev[e.k] = (ev[e.k] || 0) + 1;
  }
  const r = g.result();
  console.log(`tags/min=${((ev.tag||0)/Math.max(1,r.secs)*60).toFixed(1)} frees=${ev.free||0} shields=${ev.shield||0} n=${n} L${level} seed${seed}: ${g.over.reason} winner=${g.over.winner} score=${g.score} secs=${r.secs} events=${JSON.stringify(ev)} maxSnapBytes=${maxSnap} mistakes=${r.mistakes.length}`);
}
for (const [n, l] of [[2,"fo"],[4,"fo"],[6,"tb"],[10,"d1"],[10,"d2"],[10,"fo"]]) for (const s of [1, 2]) run(n, l, s);
