// Hold the Front Page: multiplayer server (Cloudflare Worker + Durable Objects).
// One Room object per table (A, B, C, D). The room runs the game from game.js at 20 ticks a second
// and sends each iPad only what that player is allowed to see.
import { Game, RULES, scaledRules } from './game.js';
import { COLORS, MODES, MODE_KEYS } from '../public/shared.js';

// ---- numbers you can change (then commit; Cloudflare redeploys by itself) ----
const TUNE = {
  minPlayers: 2,       // players needed before READY starts a round (teams are always equal, max 5 a side)
  maxPerTeam: 5,
  countdownSecs: 10,   // team reveal before the whistle
  rules: { ...RULES, exploreSecs: 60 }, // winScore, maxTime, cardsOnMap, spawnEvery (see game.js)
};
const MAX_SEATS = 10;
const TICK_MS = 50;
const SEND_EVERY = 2;  // send a picture every 2nd tick = 10 per second

const clean = (s) => String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 12) || 'Player';
const cleanReal = (s) => String(s || '').replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 30);
const num = (v) => typeof v === 'number' && isFinite(v);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/(ws|status|ctl)\/([A-Za-z0-9]{1,8})$/);
    if (m) {
      const id = env.ROOM.idFromName(m[2].toUpperCase());
      return env.ROOM.get(id).fetch(req);
    }
    if (url.pathname === '/health') return new Response('hold the front page server ok');
    return env.ASSETS ? env.ASSETS.fetch(req) : new Response('not found', { status: 404 });
  },
};

export class Room {
  constructor(state, env) {
    this.env = env;
    this.state = state;
    this.seats = [];          // { id, pid, token, name, ready, ws, inRound, team }
    this.phase = 'lobby';     // lobby | reveal | play | over
    this.mode = 'fo';         // fo = fact/opinion, tb = tabloid/broadsheet, d1 / d2 = four-desk device sets
    this.G = null;
    this.timer = null; this.hb = null;
    this.last = Date.now(); this.tickN = 0;
    this.revealUntil = 0;
    this.lastResult = null;
    this.round = 0;
    this.lastIn = {};
    // the level survives the room going quiet (Cloudflare unloads idle rooms)
    state.blockConcurrencyWhile(async () => { const v = await state.storage.get('mode'); if (MODE_KEYS.includes(v)) this.mode = v; });
  }

  /* ---------- connections ---------- */
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/status/')) {
      return new Response(JSON.stringify(this.status()), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (url.pathname.startsWith('/ctl/')) return this.control(url);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const conn = { ws: server, seat: null };
    server.addEventListener('message', (e) => { try { this.onMsg(conn, JSON.parse(e.data)); } catch (err) { /* ignore bad input */ } });
    const gone = () => { try { server.close(1000, 'bye'); } catch (e) { /* already closed */ } this.onClose(conn); };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Teacher controls: /ctl/<table>?key=...&cmd=start|reset|level&v=1|2
  control(url) {
    const key = (this.env && this.env.TEACHER_KEY) || '';
    const cors = { 'access-control-allow-origin': '*' };
    if (!key || url.searchParams.get('key') !== key) return new Response('wrong key', { status: 403, headers: cors });
    const cmd = url.searchParams.get('cmd');
    if (cmd === 'start') {
      if ((this.phase === 'lobby' || this.phase === 'over') && this.startRound(2)) return new Response('started', { headers: cors });
      return new Response('cannot start now (need 2 players online)', { status: 409, headers: cors });
    }
    if (cmd === 'reset') {
      this.stopTimers(); this.G = null; this.phase = 'lobby'; this.lastResult = null;
      for (const s of this.seats) { s.inRound = false; s.ready = false; }
      this.sendLobby(); if (this.online().length) this.startHeartbeat();
      return new Response('reset', { headers: cors });
    }
    if (cmd === 'mode') {
      const v = url.searchParams.get('v');
      if (!MODE_KEYS.includes(v)) return new Response('mode must be one of ' + MODE_KEYS.join(', '), { status: 400, headers: cors });
      this.mode = v; this.state.storage.put('mode', v); this.sendLobby();
      return new Response('mode ' + MODES[v].name + ' (applies from the next round)', { headers: cors });
    }
    return new Response('unknown command', { status: 400, headers: cors });
  }

  status() {
    return { phase: this.phase, round: this.round, mode: this.mode, seats: this.seats.map((s) => ({ id: s.id, name: s.name, real: s.real || '', online: !!s.ws, ready: s.ready, inRound: s.inRound, team: s.team })) };
  }
  send(seat, obj) { if (seat && seat.ws) { try { seat.ws.send(JSON.stringify(obj)); } catch (e) { /* closed */ } } }
  all(fn) { for (const s of this.seats) if (s.ws) fn(s); }
  online() { return this.seats.filter((s) => s.ws); }

  onClose(conn) {
    const s = conn.seat;
    if (!s || s.ws !== conn.ws) return;
    s.ws = null; s.ready = false;
    if (this.G && s.inRound && s.pid !== null) this.G.setInput(s.pid, 0, 0);   // a dropped iPad just stands still
    if (!this.online().length) this.stopTimers();
    else { this.sendLobby(); this.maybeStart(); }
  }

  onMsg(conn, m) {
    if (m.t === 'hello') return this.onHello(conn, m);
    const s = conn.seat; if (!s) return;
    switch (m.t) {
      case 'ready':
        if (this.phase === 'lobby' || this.phase === 'over') { s.ready = !!m.v; this.sendLobby(); this.maybeStart(); }
        break;
      case 'vote':
        if (this.phase === 'reveal' && s.inRound && this.G && s.pid !== null) { this.G.vote(s.pid, num(m.v) ? m.v | 0 : -1); this.sendVotes(); }
        break;
      case 'role':
        if (this.phase === 'lobby' || this.phase === 'over') { s.role = m.v === 'D' ? 'D' : 'A'; this.sendLobby(); }
        break;
      case 'name':
        if (this.phase === 'lobby' || this.phase === 'over') { s.name = clean(m.name); this.sendLobby(); }
        break;
      case 'in':
        if (this.phase !== 'play' || !s.inRound || !num(m.x) || !num(m.y)) break;
        this.G.setInput(s.pid, Math.max(-1, Math.min(1, m.x)), Math.max(-1, Math.min(1, m.y)));
        break;
      case 'power':
        if (this.phase === 'play' && s.inRound) this.G.usePower(s.pid, num(m.i) ? m.i | 0 : 0);
        break;
      case 'drop':
        if (this.phase === 'play' && s.inRound) this.G.drop(s.pid);
        break;
      default: break;
    }
  }

  onHello(conn, m) {
    let seat = m.token ? this.seats.find((s) => s.token === m.token) : null;
    if (!seat) {
      if (this.seats.length >= MAX_SEATS) { try { conn.ws.send(JSON.stringify({ t: 'full' })); } catch (e) { /* */ } return; }
      const used = new Set(this.seats.map((s) => s.id));
      let id = 0; while (used.has(id)) id++;
      seat = { id, pid: null, token: Math.random().toString(36).slice(2) + Date.now().toString(36), name: clean(m.name), real: cleanReal(m.real), ready: false, ws: null, inRound: false, team: null, role: 'A' };
      this.seats.push(seat);
    } else if (m.name && (this.phase === 'lobby' || this.phase === 'over')) { seat.name = clean(m.name); if (m.real) seat.real = cleanReal(m.real); }
    if (seat.ws && seat.ws !== conn.ws) { const old = seat.ws; seat.ws = null; try { old.close(); } catch (e) { /* */ } }
    conn.seat = seat; seat.ws = conn.ws;
    this.send(seat, { t: 'hi', seat: seat.id, token: seat.token });
    this.sendLobby();
    if (this.G && seat.inRound && this.phase !== 'lobby') {
      this.send(seat, this.roundMsg(seat));
      if (this.phase === 'reveal') this.send(seat, { t: 'votes', ...this.G.voteInfo(seat.pid) });
      if (this.phase !== 'over') this.send(seat, this.G.snapshot(seat.pid));
      if (!this.timer && this.phase !== 'over') { this.last = Date.now(); this.startTimers(); }
    }
    if (this.phase === 'over' && this.lastResult) this.send(seat, { t: 'over', result: this.lastResult });
    this.startHeartbeat();
  }

  sendLobby() {
    const seats = this.seats.map((s) => ({ id: s.id, name: s.name, ready: s.ready, online: !!s.ws }));
    this.all((s) => this.send(s, { t: 'lobby', phase: this.phase, seats, you: s.id, inRound: s.inRound, round: this.round, min: TUNE.minPlayers, mode: this.mode, role: s.role }));
  }

  maybeStart() {
    if (this.phase !== 'lobby' && this.phase !== 'over') return;
    const on = this.online();
    if (on.length >= TUNE.minPlayers && on.every((s) => s.ready)) this.startRound(TUNE.minPlayers);
  }

  /* ---------- rounds ---------- */
  startRound(min) {
    const on = this.online();
    if (on.length < min) return false;
    // teams are always EQUAL (max 5 a side). Anyone left over (odd number, or more than 10) sits out this
    // round and is first in line next round.
    const sorted = on.map((s) => ({ s, r: Math.random() - (s.sat ? 2 : 0) })).sort((a, b) => a.r - b.r).map((x) => x.s);
    const take = Math.min(sorted.length - (sorted.length % 2), TUNE.maxPerTeam * 2);
    if (take < 2) return false;
    const order = sorted.slice(0, take);
    for (const s of sorted.slice(take)) { s.sat = true; s.pid = null; s.team = null; }
    for (const s of order) s.sat = false;
    const flip = Math.random() < 0.5 ? 1 : 0;
    order.forEach((s, i) => { s.pid = i; s.team = (i + flip) % 2; });
    for (const s of this.seats) if (!s.ws) { s.pid = null; s.team = null; }
    const roster = order.map((s) => ({ id: s.pid, name: s.name, color: COLORS[s.id % COLORS.length], team: s.team, role: s.role }));
    const n = order.length;
    const rules = scaledRules(n, TUNE.rules);
    this.G = new Game({ mode: this.mode, roster, seed: 1 + Math.floor(Math.random() * 1e9), rules });
    for (const s of this.seats) { s.inRound = !!s.ws && order.includes(s); s.ready = false; }
    this.round++;
    this.lastResult = null; this.lastIn = {};
    this.phase = 'reveal'; this.revealUntil = Date.now() + TUNE.countdownSecs * 1000;
    this.sendLobby();
    for (const s of order) { this.send(s, this.roundMsg(s)); this.send(s, this.G.snapshot(s.pid)); }
    this.sendVotes();
    this.last = Date.now(); this.tickN = 0;
    this.startTimers();
    return true;
  }

  sendVotes() {
    if (!this.G) return;
    for (const s of this.online()) if (s.inRound && s.pid !== null) this.send(s, { t: 'votes', ...this.G.voteInfo(s.pid) });
  }

  roundMsg(seat) {
    const G = this.G;
    return {
      t: 'round', phase: this.phase, you: seat.pid, team: seat.team, role: seat.role, caps: G.captain.slice(), explore: G.rules.exploreSecs || 0, fog: G.rules.fog ? 1 : 0, mode: G.mode, round: this.round,
      revealLeft: Math.max(0, this.revealUntil - Date.now()), winScore: G.rules.winScore, maxTime: G.rules.maxTime,
      players: G.players.map((q) => ({ id: q.id, name: q.name, color: q.color, team: q.team })),
    };
  }

  /* ---------- timers ---------- */
  startTimers() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    this.startHeartbeat();
  }
  startHeartbeat() {
    if (!this.hb) this.hb = setInterval(() => this.all((s) => this.send(s, { t: 'hb' })), 3000);
  }
  stopTimers() {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    if (this.hb) clearInterval(this.hb); this.hb = null;
  }

  tick() {
    const G = this.G; if (!G) return;
    const now = Date.now();
    const dt = Math.min(0.2, (now - this.last) / 1000); this.last = now;
    if (this.phase === 'reveal') {
      if (now >= this.revealUntil) { G.pickCaptains(); this.phase = 'play'; this.sendLobby(); this.all((s) => { if (s.inRound) this.send(s, { t: 'go', caps: G.captain.slice() }); }); }
      return;
    }
    if (this.phase !== 'play') return;
    G.update(dt);
    if (G.over) return this.endRound();
    if (++this.tickN % SEND_EVERY === 0) {
      for (const s of this.online()) if (s.inRound && s.pid !== null) this.send(s, G.snapshot(s.pid));
      G.events.length = 0;
    }
  }

  endRound() {
    const G = this.G;
    this.phase = 'over';
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.lastResult = G.result();
    for (const s of this.seats) s.ready = false;
    this.all((s) => { if (s.inRound) this.send(s, G.snapshot(s.pid)); this.send(s, { t: 'over', result: this.lastResult }); });
    G.events.length = 0;
    this.sendLobby();
  }
}
