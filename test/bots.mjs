import { MAP, W, H, solid } from '../public/shared.js';
// Computer players for tests and for the one-player version.
// Skill changes how often they mislabel a card, how long they "read" after picking one up,
// how far they will chase, and whether they use powers well.
export const SKILLS = {
  easy:   { mistake: 0.30, think: 1.8, refresh: 0.6, chase: 5, power: 0.35 },
  normal: { mistake: 0.15, think: 1.1, refresh: 0.4, chase: 8, power: 0.8 },
  hard:   { mistake: 0.05, think: 0.6, refresh: 0.25, chase: 11, power: 1 },
};
function field(tx, ty) {
  const d = new Int16Array(W * H).fill(-1); const q = [[tx, ty]]; d[ty * W + tx] = 0;
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; if (solid(nx, ny) || d[ny*W+nx] >= 0) continue; d[ny*W+nx] = d[y*W+x] + 1; q.push([nx, ny]); } }
  return d;
}
export class Bot {
  constructor(game, id, skill = 'normal') {
    this.g = game; this.id = id; this.k = typeof skill === 'string' ? SKILLS[skill] : skill;
    this.raider = skill !== 'easy' && id % 3 === 2;   // some bots like to raid
    this.t = Math.random() * 0.3; this.f = null; this.wrong = false; this.lastU = null; this.thinkT = 0;
  }
  tick(dt) {
    const g = this.g, p = g.players[this.id], k = this.k; this.t -= dt;
    if (p.tied && p.powers.indexOf('B') >= 0 && Math.random() < k.power * 0.15) g.usePower(this.id, p.powers.indexOf('B'));
    if (p.stun > 0 || p.tied || p.freeze > 0) { g.setInput(this.id, 0, 0); this.lastU = p.carry ? p.carry.u : null; return; }
    // read the card for a moment after picking it up (standing still makes you easy to catch)
    if (p.carry && p.carry.u !== this.lastU) { this.lastU = p.carry.u; this.thinkT = k.think * (0.6 + Math.random() * 0.8); this.wrong = Math.random() < k.mistake; this.t = 0; }
    if (!p.carry) this.lastU = null;
    if (this.thinkT > 0) { this.thinkT -= dt; g.setInput(this.id, 0, 0); return; }
    // powers: use the right one at the right moment
    if (p.powers.length) {
      const foes = g.players.filter((e) => e.team !== p.team && !e.tied && Math.hypot(e.x - p.x, e.y - p.y) < 5);
      const has = (c) => p.powers.indexOf(c);
      if (foes.length && Math.random() < k.power * 0.2) {
        const near = foes.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 3);
        if (p.carry && has('H') >= 0 && p.shieldT <= 0) g.usePower(this.id, has('H'));
        else if (near && has('Z') >= 0) g.usePower(this.id, has('Z'));
        else if (has('N') >= 0 && !p.carry) g.usePower(this.id, has('N'));
        else if (has('S') >= 0 && p.sprintT <= 0) g.usePower(this.id, has('S'));
      }
      if (has('R') >= 0 && g.radarT[p.team] <= 0 && Math.random() < k.power * 0.004) g.usePower(this.id, has('R'));
    }
    if (this.t <= 0) {
      this.t = k.refresh; let tg = null;
      if (p.carry) {
        const kinds = g.kinds;
        let c = p.carry.card.c; if (this.wrong) c = kinds[(kinds.indexOf(c) + 1) % kinds.length];
        const d = MAP.desks.find((q) => q.team === p.team && q.kind === c);
        tg = [Math.floor((d.x0 + d.x1) / 2), Math.floor((d.y0 + d.y1) / 2)];
      } else {
        // rescue a tied teammate first, then chase an enemy carrier you can see, otherwise the nearest card
        let best = 1e9;
        for (const t of g.players) if (t.team === p.team && t.tied) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < best) { best = d; tg = [Math.floor(t.x), Math.floor(t.y)]; } }
        if (!tg) { best = 1e9; for (const e of g.players) if (e.team !== p.team && e.carry && !e.hide && !e.tied) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < k.chase && d < best) { best = d; tg = [Math.floor(e.x), Math.floor(e.y)]; } } }
        // raiders: take the portal into enemy land, then hunt carriers around their forward desks
        if (!tg && this.raider) {
          const home = p.team === 0 ? p.x < W / 2 : p.x >= W / 2;
          if (home && p.raidCd <= 0) { const ts = MAP.tubes.filter((t) => t.raid && (p.team === 0 ? t.x < W / 2 : t.x >= W / 2)); const t = ts[Math.floor(this.id / 3) % ts.length]; tg = [t.x, t.y]; }
          else if (!home) { best = 1e9; for (const e of g.players) if (e.team !== p.team && e.carry && !e.hide && !e.tied) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < best) { best = d; tg = [Math.floor(e.x), Math.floor(e.y)]; } } if (!tg) { const ed = MAP.desks.find((q) => q.team !== p.team && q.kind === (this.id % 2 ? 'F' : 'O')); tg = [Math.floor((ed.x0 + ed.x1) / 2), Math.floor((ed.y0 + ed.y1) / 2)]; } }
        }
        if (!tg) { best = 1e9; for (const c of g.floor) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < best) { best = d; tg = [Math.floor(c.x), Math.floor(c.y)]; } } }
      }
      this.f = tg ? field(tg[0], tg[1]) : null;
    }
    if (!this.f) { g.setInput(this.id, 0, 0); return; }
    const cx = Math.floor(p.x), cy = Math.floor(p.y); let bd = this.f[cy * W + cx], bx = cx, by = cy;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const nx = cx+dx, ny = cy+dy; if (solid(nx, ny) || (dx && dy && (solid(cx+dx, cy) || solid(cx, cy+dy)))) continue; const v = this.f[ny*W+nx]; if (v >= 0 && v < bd) { bd = v; bx = nx; by = ny; } }
    const vx = bx + 0.5 - p.x, vy = by + 0.5 - p.y; const l = Math.hypot(vx, vy) || 1;
    g.setInput(this.id, bx === cx && by === cy ? 0 : vx / l, bx === cx && by === cy ? 0 : vy / l);
  }
}
