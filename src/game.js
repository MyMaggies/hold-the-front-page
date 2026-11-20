// Hold the Front Page: the game rules. Runs on the server (one Game per table per round).
// No DOM here. test/ runs this file with computer-controlled players.
import { MAP, CFG, KINDS, MODES, POWER_KEYS, ROLES, step, los, cellAt, T, deskOf, W } from '../public/shared.js';
import { Deck } from './cards.js';

export const RULES = {
  winScore: 14,        // first team to this many correct deliveries wins (small tables; see scaledRules)
  maxTime: 420,        // seconds; most points wins if nobody reaches winScore
  cardsOnMap: 3,       // cards lying on the floor at once: few, so teams fight over them
  cardsInPlay: 5,      // floor + carried: no new card appears while this many are already out
  spawnEvery: 1.8,     // seconds between new cards appearing
  powerMax: 8,         // power-ups lying in dead ends at once
  powerEvery: 7,      // seconds between new power-ups
  startPowers: 1,      // 1 = start with the SPRINTs and role powers, 0 = start with none
  fog: false,          // true = fog of war (you only see what your team sees); false = everyone sees the whole map
  exploreSecs: 0,      // warm-up before the match where everyone can walk around (the server sets 60)
  captainRadars: 5,    // the elected captain gets this many RADARs (nobody else gets any)
  raidCooldown: 15,   // seconds before the same player can use a raid portal again
};

// Bigger tables score faster, so the target grows with the number of players.
export function scaledRules(n, base = RULES) {
  return { ...base, winScore: n >= 9 ? 20 : n >= 7 ? 17 : n <= 3 ? 10 : base.winScore, maxTime: n >= 9 ? 540 : n >= 7 ? 480 : base.maxTime };
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (v) => Math.round(v * 100) / 100;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Game {
  // roster: [{ id, name, color, team }]
  constructor({ mode, level = 1, roster, seed = 1, rules = {} }) {
    this.rules = Object.assign({}, RULES, rules);
    this.mode = MODES[mode] ? mode : (level >= 2 ? 'd1' : 'fo');    // fo, tb, d1 or d2 (see MODES)
    this.level = this.mode;
    this.kinds = MODES[this.mode].kinds;
    this.rng = mulberry(seed);
    this.deck = new Deck(this.mode, this.rng);
    this.time = 0;
    this.score = [0, 0];
    this.tally = [{ ok: 0, bad: 0 }, { ok: 0, bad: 0 }];
    this.floor = [];          // cards lying on the floor: { u, card, x, y }
    this.uid = 1;
    this.events = [];
    this.mistakes = [];       // wrong deliveries, for the review screen
    this.over = null;
    this.spawnT = 0.5;
    const slot = [0, 0];
    this.players = roster.map((r) => {
      const st = MAP.starts[r.team][slot[r.team]++ % 10];
      return {
        id: r.id, name: r.name, color: r.color, team: r.team, role: r.role === 'D' ? 'D' : 'A',
        x: st[0], y: st[1], ix: 0, iy: 0, a: r.team === 0 ? 0 : Math.PI,
        carry: null, stun: 0, grace: 0, hide: false, hideT: 0, moving: false,
        tubeLock: false, pickLock: 0, ok: 0, bad: 0, tags: 0, saves: 0,
        tied: false, tiedT: 0, freeze: 0, raidCd: 0, powers: [], sprintT: 0, shieldT: 0,
      };
    });
    this.pups = [];            // power-ups on the floor: { u, kind, x, y }
    this.pupT = 4;
    this.radarT = [0, 0];
    this.votes = {};           // captain votes: voter id -> candidate id
    this.captain = [-1, -1];
    for (const q of this.players) q.powers = this.startKit(q.role);
    this.exploreT = this.rules.exploreSecs || 0;
    if (!this.exploreT) this.begin();
  }

  // the match proper starts: put everyone back at their start spots and deal the first cards
  begin() {
    const slot = [0, 0];
    for (const p of this.players) { const st = MAP.starts[p.team][slot[p.team]++ % 10]; p.x = st[0]; p.y = st[1]; p.ix = 0; p.iy = 0; p.raidCd = 0; p.tubeLock = false; p.hide = false; p.hideT = 0; }
    for (let i = 0; i < this.rules.cardsOnMap; i++) this.spawnCard();
    for (let i = 0; i < 2; i++) this.spawnPower();
    this.events.push({ k: 'begin' });
  }

  kindActive(k) { return this.kinds.includes(k); }
  emit(e) { this.events.push(e); }

  spawnCard() {
    const pts = MAP.spawns.filter(([x, y]) =>
      !this.floor.some((c) => Math.hypot(c.x - x, c.y - y) < 3) &&
      !this.players.some((p) => Math.hypot(p.x - x, p.y - y) < 1.5));
    if (!pts.length) return false;
    const [x, y] = pts[Math.floor(this.rng() * pts.length)];
    this.floor.push({ u: this.uid++, card: this.deck.draw(), x, y });
    this.emit({ k: 'ping', x: r2(x), y: r2(y) });   // everyone sees a ping, never the card type
    return true;
  }

  spawnPower() {
    const pts = MAP.powerSpots.filter(([x, y]) =>
      !this.pups.some((c) => Math.hypot(c.x - x, c.y - y) < 2) &&
      !this.players.some((p) => Math.hypot(p.x - x, p.y - y) < 1.5));
    if (!pts.length) return false;
    const [x, y] = pts[Math.floor(this.rng() * pts.length)];
    this.pups.push({ u: this.uid++, kind: POWER_KEYS[Math.floor(this.rng() * POWER_KEYS.length)], x, y });
    return true;
  }

  // everyone gets three SPRINTs, plus the two powers that go with their role
  startKit(role) {
    if (!this.rules.startPowers) return [];
    return ['S', 'S', 'S', ...ROLES[role === 'D' ? 'D' : 'A'].kit];
  }

  // ---- captains: each team votes during the countdown; most votes wins (ties are drawn at random) ----
  vote(voter, cand) {
    const a = this.players[voter], b = this.players[cand];
    if (!a || !b || a.team !== b.team) return;
    this.votes[voter] = cand;
  }
  voteInfo(id) {
    const me = this.players[id], tally = {};
    for (const q of this.players) if (q.team === me.team) tally[q.id] = 0;
    for (const v in this.votes) if (tally[this.votes[v]] !== undefined && this.players[v].team === me.team) tally[this.votes[v]]++;
    return { tally, mine: this.votes[id] === undefined ? -1 : this.votes[id] };
  }
  pickCaptains() {
    for (let t = 0; t < 2; t++) {
      const mem = this.players.filter((q) => q.team === t); if (!mem.length) continue;
      const n = (q) => Object.keys(this.votes).filter((v) => this.votes[v] === q.id && this.players[v].team === t).length;
      const top = Math.max(...mem.map(n)), cand = mem.filter((q) => n(q) === top);
      const cap = cand[Math.floor(this.rng() * cand.length)];
      this.captain[t] = cap.id;
      for (let i = 0; i < this.rules.captainRadars; i++) cap.powers.push('R');
    }
  }

  usePower(id, idx = 0) {
    const p = this.players[id];
    if (!p || p.stun > 0 || this.over || this.exploreT > 0) return;
    const kind = p.powers[idx]; if (!kind) return;
    if (p.tied && kind !== 'B') return;
    if (kind === 'S') { if (p.sprintT > 0) return; p.sprintT = CFG.sprintSecs; }
    else if (kind === 'H') { if (p.shieldT > 0) return; p.shieldT = CFG.shieldSecs; }
    else if (kind === 'B') { if (!p.tied) return; p.tiedT -= CFG.snipSecs; }
    else if (kind === 'Z') {
      for (const e of this.players) if (e.team !== p.team && dist(e, p) <= CFG.blastR) { e.freeze = CFG.freezeSecs; e.hide = false; e.ix = 0; e.iy = 0; }
      this.emit({ k: 'blast', by: p.id, x: r2(p.x), y: r2(p.y) });
    }
    else if (kind === 'N') {
      let tg = null, best = 1e9;
      for (const e of this.players) {
        if (e.team === p.team || e.hide || e.tied || e.stun > 0) continue;
        const d = dist(e, p); if (d > CFG.netR || !los(p.x, p.y, e.x, e.y)) continue;
        const sc = d - (e.carry ? 100 : 0); if (sc < best) { best = sc; tg = e; }
      }
      if (!tg) { this.emit({ k: 'nonet', to: p.id }); return; }
      tg.freeze = CFG.netSecs; tg.ix = 0; tg.iy = 0; tg.hide = false;
      this.emit({ k: 'net', by: p.id, who: tg.id, x: r2(p.x), y: r2(p.y), tx: r2(tg.x), ty: r2(tg.y) });
    }
    else if (kind === 'R') { if (this.radarT[p.team] > 0) return; this.radarT[p.team] = CFG.radarSecs; this.emit({ k: 'radar', team: p.team }); }
    p.powers.splice(idx, 1);
    this.emit({ k: 'use', to: p.id, kind });
  }

  setInput(id, x, y) {
    const p = this.players[id]; if (!p) return;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    p.ix = x; p.iy = y;
  }

  drop(id) {
    const p = this.players[id];
    if (!p || !p.carry || p.stun > 0 || p.tied || this.over) return;
    this.floor.push({ u: p.carry.u, card: p.carry.card, x: p.x, y: p.y });
    p.carry = null; p.pickLock = CFG.pickLock;
    this.emit({ k: 'drop', to: p.id });
    this.emit({ k: 'ping', x: r2(p.x), y: r2(p.y) });
  }

  // warm-up: walk about, use portals, see where cards will appear. No cards, tags or points yet.
  updateExplore(dt) {
    this.exploreT -= dt;
    for (const p of this.players) {
      p.tied = false; p.carry = null;
      const moved = step(p, p.ix, p.iy, dt, CFG.speed);
      p.moving = moved; if (moved) p.a = Math.atan2(p.iy, p.ix);
      const onTube = cellAt(p.x, p.y) === T.TUBE;
      if (!onTube) { p.tubeLock = false; continue; }
      if (p.tubeLock) continue;
      const tube = MAP.tubes.find((t) => t.x === Math.floor(p.x) && t.y === Math.floor(p.y));
      if (!tube) continue;
      p.x = tube.to[0] + 0.5; p.y = tube.to[1] + 0.5; p.tubeLock = true;
      this.emit({ k: 'tube', to: p.id, x: r2(p.x), y: r2(p.y), raid: tube.raid ? 1 : 0 });
    }
    if (this.exploreT <= 0) { this.exploreT = 0; this.begin(); }
  }

  update(dt) {
    if (this.over) return;
    const P = this.players;
    if (this.exploreT > 0) { this.updateExplore(dt); return; }
    this.time += dt;
    for (let t = 0; t < 2; t++) if (this.radarT[t] > 0) this.radarT[t] -= dt;

    for (const p of P) {
      if (p.sprintT > 0) p.sprintT -= dt;
      if (p.shieldT > 0) p.shieldT -= dt;
      if (p.raidCd > 0) p.raidCd -= dt;
      if (p.tied) {
        p.moving = false; p.hide = false; p.tiedT -= dt;
        if (p.tiedT <= 0) { p.tied = false; p.grace = CFG.graceSecs; this.emit({ k: 'free', by: p.id, who: p.id, self: 1 }); }
        continue;
      }
      if (p.stun > 0) { p.stun -= dt; p.moving = false; p.hide = false; if (p.stun <= 0) p.grace = CFG.graceSecs; continue; }
      if (p.grace > 0) p.grace -= dt;
      if (p.pickLock > 0) p.pickLock -= dt;
      if (p.freeze > 0) { p.freeze -= dt; p.moving = false; p.hide = false; continue; }
      const speed = CFG.speed * (p.carry ? CFG.carryMult : 1) * (p.sprintT > 0 ? CFG.sprintMult : 1);
      const moved = step(p, p.ix, p.iy, dt, speed);
      p.moving = moved;
      if (moved) { p.a = Math.atan2(p.iy, p.ix); p.hide = false; }
      // hiding: stand still on a cupboard
      if (!moved && cellAt(p.x, p.y) === T.CUPBOARD) { p.hideT += dt; if (p.hideT >= CFG.hideSecs) p.hide = true; }
      else { p.hideT = 0; if (moved) p.hide = false; }
    }

    // players push each other a little so a body can block a corridor
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j];
      if (a.stun > 0 || b.stun > 0 || a.tied || b.tied) continue;
      const d = dist(a, b), min = CFG.radius * 2;
      if (d < min && d > 0.001) {
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, o = (min - d) / 2;
        step(a, -nx, -ny, 1, o); step(b, nx, ny, 1, o);
      }
    }

    // tubes (step onto a tube mouth to be sent to its partner)
    for (const p of P) {
      if (p.stun > 0 || p.tied) continue;
      const onTube = cellAt(p.x, p.y) === T.TUBE;
      if (!onTube) { p.tubeLock = false; continue; }
      if (p.tubeLock) continue;
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      const tube = MAP.tubes.find((t) => t.x === cx && t.y === cy);
      if (!tube) continue;
      if (tube.raid && (p.carry || p.raidCd > 0)) {   // raid portals: no cards through, and a cooldown
        p.tubeLock = true; this.emit({ k: 'raidno', to: p.id, why: p.carry ? 'carry' : 'cool', cd: r2(Math.max(0, p.raidCd)) }); continue;
      }
      if (tube.raid) p.raidCd = this.rules.raidCooldown;
      p.x = tube.to[0] + 0.5; p.y = tube.to[1] + 0.5; p.tubeLock = true; p.hide = false; p.hideT = 0;
      this.emit({ k: 'tube', to: p.id, x: r2(p.x), y: r2(p.y), raid: tube.raid ? 1 : 0 });
    }

    // pick up cards
    for (const p of P) {
      if (p.carry || p.stun > 0 || p.tied || p.pickLock > 0) continue;
      const i = this.floor.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < 0.65);
      if (i < 0) continue;
      const c = this.floor.splice(i, 1)[0];
      p.carry = { u: c.u, card: c.card };
      this.emit({ k: 'pick', to: p.id }); this.emit({ k: 'carry', team: p.team, by: p.id });
    }

    // deliver to your own team's desks
    for (const p of P) {
      if (!p.carry || p.stun > 0 || p.tied) continue;
      const d = deskOf(p.x, p.y);
      if (!d || d.team !== p.team || !this.kindActive(d.kind)) continue;
      const card = p.carry.card;
      p.carry = null;
      if (card.c === d.kind) {
        this.score[p.team]++; this.tally[p.team].ok++; p.ok++;
        this.emit({ k: 'ok', p: p.id, team: p.team, kind: d.kind, score: this.score.slice() });
        this.emit({ k: 'ok2', to: p.id, text: card.t, w: card.w, kind: d.kind });
      } else {
        this.tally[p.team].bad++; p.bad++; p.stun = CFG.stunSecs;
        if (!this.mistakes.some((m) => m.t === card.t)) this.mistakes.push({ t: card.t, c: card.c, w: card.w, team: p.team, said: d.kind });
        this.emit({ k: 'bad', to: p.id, p: p.id, kind: d.kind, text: card.t, c: card.c, w: card.w });
        this.emit({ k: 'bad2', p: p.id, team: p.team });
      }
    }

    // power-ups: walk over one while you have room
    for (const p of P) {
      if (p.powers.length >= CFG.maxPowers || p.stun > 0 || p.tied) continue;
      const i = this.pups.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < 0.65);
      if (i < 0) continue;
      const kind = this.pups.splice(i, 1)[0].kind; p.powers.push(kind);
      this.emit({ k: 'pup', to: p.id, kind });
    }

    // rescues: a free teammate touching a tied-up player unties them
    for (const t of P) {
      if (!t.tied) continue;
      const f = P.find((q) => q.team === t.team && q.id !== t.id && !q.tied && q.stun <= 0 && dist(q, t) <= CFG.rescueDist);
      if (!f) continue;
      t.tied = false; t.grace = CFG.graceSecs; f.saves++;
      this.emit({ k: 'free', by: f.id, who: t.id });
    }

    // tags: a free player WITHOUT a card touches an enemy WITH one and steals it; the victim is tied up
    for (const c of P) {
      if (!c.carry || c.tied || c.stun > 0 || c.grace > 0) continue;
      const e = P.find((q) => q.team !== c.team && !q.carry && !q.tied && q.stun <= 0 && dist(q, c) <= CFG.tagDist);
      if (!e) continue;
      if (c.shieldT > 0) {          // SHIELD: the tag bounces off
        c.shieldT = 0; c.grace = 0.8; e.stun = CFG.shieldStun;
        this.emit({ k: 'shield', by: e.id, who: c.id, x: r2(c.x), y: r2(c.y) });
        continue;
      }
      e.carry = c.carry; c.carry = null;
      c.tied = true; c.tiedT = CFG.tiedSecs; c.hide = false; c.sprintT = 0; c.ix = 0; c.iy = 0;
      e.grace = Math.max(e.grace, CFG.stealGrace); e.hide = false;
      e.tags++;
      this.emit({ k: 'tag', by: e.id, who: c.id, x: r2(c.x), y: r2(c.y), steal: 1 });
      this.emit({ k: 'pick', to: e.id }); this.emit({ k: 'carry', team: e.team, by: e.id, steal: 1 });
    }

    // new cards
    this.spawnT -= dt;
    const inPlay = this.floor.length + this.players.filter((q) => q.carry).length;
    if (this.spawnT <= 0 && this.floor.length < this.rules.cardsOnMap && inPlay < this.rules.cardsInPlay) { if (this.spawnCard()) this.spawnT = this.rules.spawnEvery; else this.spawnT = 0.5; }

    this.pupT -= dt;
    if (this.pupT <= 0) { if (this.pups.length < this.rules.powerMax && this.spawnPower()) this.pupT = this.rules.powerEvery; else this.pupT = 3; }

    // end of match
    for (let t = 0; t < 2; t++) if (this.score[t] >= this.rules.winScore) this.over = { winner: t, reason: 'score' };
    if (!this.over && this.time >= this.rules.maxTime) this.over = { winner: this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1), reason: 'time' };
  }

  /* ---------- what each player is allowed to see ---------- */
  visibleTo(viewer) {
    if (!this.rules.fog) return new Set(this.players.filter((q) => q.team === viewer.team || !q.hide || dist(q, viewer) <= CFG.foundDist).map((q) => q.id));
    const mates = this.players.filter((q) => q.team === viewer.team);
    const seen = new Set(mates.map((m) => m.id));
    const radar = this.radarT[viewer.team] > 0;
    for (const e of this.players) {
      if (e.team === viewer.team) continue;
      if (radar) { seen.add(e.id); continue; }
      for (const m of mates) {
        const d = dist(m, e);
        if (d > CFG.vis) continue;
        if (e.hide && d > CFG.foundDist) continue;
        if (!los(m.x, m.y, e.x, e.y)) continue;
        seen.add(e.id); break;
      }
    }
    return seen;
  }

  snapshot(id) {
    const v = this.players[id];
    const seen = this.visibleTo(v);
    const mates = this.players.filter((q) => q.team === v.team);
    const lit = (x, y) => !this.rules.fog || mates.some((m) => Math.hypot(m.x - x, m.y - y) <= CFG.vis && los(m.x, m.y, x, y));
    const players = [];
    for (const q of this.players) {
      if (!seen.has(q.id)) continue;
      const mate = q.team === v.team;
      const o = { cp: this.captain[q.team] === q.id ? 1 : 0, i: q.id, x: r2(q.x), y: r2(q.y), a: Math.round(q.a * 10) / 10, m: q.moving ? 1 : 0, s: r2(Math.max(0, q.stun)), g: q.grace > 0 ? 1 : 0, h: q.hide ? 1 : 0, c: q.carry ? 1 : 0, t: q.tied ? 1 : 0, sp: q.sprintT > 0 ? 1 : 0, sh: q.shieldT > 0 ? 1 : 0, fz: q.freeze > 0 ? 1 : 0 };
      if (q.id === id) { o.pw = q.powers.slice(); o.tt = r2(Math.max(0, q.tiedT)); o.rd = r2(Math.max(0, this.radarT[q.team])); o.spt = r2(Math.max(0, q.sprintT)); o.sht = r2(Math.max(0, q.shieldT)); o.rc = r2(Math.max(0, q.raidCd)); o.ex = r2(Math.max(0, this.exploreT)); o.rl = q.role; }
      if (q.carry && mate && (q.id === id || dist(q, v) <= CFG.teammateRead)) o.ct = q.carry.card.t;
      players.push(o);
    }
    const ev = this.events.filter((e) => e.to === undefined || e.to === id).map((e) => { const c = { ...e }; delete c.to; return c; });
    return {
      t: 's', ec: this.players.filter((q) => q.team !== v.team && q.carry).length, mc: this.players.filter((q) => q.team === v.team && q.carry).length, time: r2(this.time), left: Math.max(0, Math.ceil(this.rules.maxTime - this.time)), sc: this.score,
      p: players, cards: this.floor.filter((c) => lit(c.x, c.y)).map((c) => [c.u, r2(c.x), r2(c.y)]), pu: this.pups.filter((c) => lit(c.x, c.y)).map((c) => [c.u, c.kind, r2(c.x), r2(c.y)]), ev,
    };
  }

  result() {
    return {
      mode: this.mode, level: this.mode, winner: this.over.winner, reason: this.over.reason, score: this.score, tally: this.tally, secs: Math.round(this.time),
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, team: p.team, ok: p.ok, bad: p.bad, tags: p.tags, saves: p.saves })),
      mistakes: this.mistakes.slice(0, 6).map((m) => ({ t: m.t, c: MODES[this.mode].names[m.c].name, w: m.w, team: m.team, said: MODES[this.mode].names[m.said].name })),
    };
  }
}
