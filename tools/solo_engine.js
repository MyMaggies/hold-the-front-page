/* ===== one-player engine: runs the real game rules in the page and plays bots ===== */
const SOLO_OPTS = Object.assign({ per: 5, mode: 'fo', skill: 'normal', powers: 'on', role: 'A', warm: 'on', fog: 'off' }, JSON.parse(store.get('htfp_solo', '{}')));
let SG = null, SBOTS = [], sAcc = 0, sLast = 0, sPhase = 'idle', sRevealEnd = 0, sTick = 0;
const BOT_NAMES = ['Maya', 'Leo', 'Ava', 'Noah', 'Zara', 'Omar', 'Ivy', 'Kai', 'Luca', 'Mia', 'Finn'];
function soloMenu() {
  show('solo');
  const box = $('soloOpts');
  const paint = () => { const r = ROLES[SOLO_OPTS.role] || ROLES.A; $('soloRoleInfo').innerHTML = `<b>${r.icon} ${r.name}</b><div class="rk">${powerLine('S', '3 x')}${r.kit.map((c) => powerLine(c)).join('')}</div>`; box.querySelectorAll('.optrow').forEach((r) => r.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(SOLO_OPTS[r.dataset.opt]) === b.dataset.v))); }
  box.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.closest('.optrow').dataset.opt; const v = b.dataset.v; SOLO_OPTS[k] = /^\d+$/.test(v) ? +v : v; store.set('htfp_solo', JSON.stringify(SOLO_OPTS)); paint(); };
  paint();
  $('soloPlay').onclick = () => { audio(); soloStart(); };
}
function soloStart() {
  audio();
  const o = SOLO_OPTS, n = o.per * 2, myTeam = Math.random() < 0.5 ? 0 : 1;
  const roster = [], cnt = [0, 0]; const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  roster.push({ id: 0, name: store.get('htfp_name', 'You'), color: '#ef5350', team: myTeam, role: o.role }); cnt[myTeam]++;
  for (let i = 1; i < n; i++) { const t = cnt[0] <= cnt[1] ? 0 : 1; cnt[t]++; roster.push({ id: i, role: Math.random() < 0.5 ? 'A' : 'D', name: names[i - 1], color: ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da', '#ec407a', '#d4e157', '#8d6e63', '#78909c'][(i - 1) % 9], team: t }); }
  const rules = scaledRules(n, RULES);
  if (o.powers === 'off') { rules.powerMax = 0; rules.startPowers = 0; }
  rules.exploreSecs = o.warm === 'on' ? 60 : 0; rules.fog = o.fog === 'on';
  SG = new Game({ mode: o.mode, roster, seed: 1 + Math.floor(Math.random() * 1e9), rules });
  SBOTS = roster.slice(1).map((r) => new Bot(SG, r.id, o.skill));
  S.phase = 'reveal'; sPhase = 'reveal'; sRevealEnd = performance.now() + 10000; sLast = performance.now(); sAcc = 0; sTick = 0;
  onMsg({ t: 'round', phase: 'reveal', you: 0, team: myTeam, mode: o.mode, round: 1, role: o.role, explore: rules.exploreSecs, fog: rules.fog ? 1 : 0, caps: [-1, -1], revealLeft: 10000, winScore: rules.winScore, maxTime: rules.maxTime, players: roster });
  for (const r of roster.slice(1)) { const mates = roster.filter((q) => q.team === r.team); SG.vote(r.id, mates[Math.floor(Math.random() * mates.length)].id); }
  onMsg(SG.snapshot(0)); SG.events.length = 0; onMsg({ t: 'votes', ...SG.voteInfo(0) });
  $('quitBtn').classList.remove('hide');
}
function soloSend(m) {
  if (!SG) return;
  if (m.t === 'ready') { if (m.v) soloStart(); return; }
  if (m.t === 'role') { SOLO_OPTS.role = m.v === 'D' ? 'D' : 'A'; store.set('htfp_solo', JSON.stringify(SOLO_OPTS)); return; }
  if (m.t === 'vote' && sPhase === 'reveal') { SG.vote(0, m.v | 0); onMsg({ t: 'votes', ...SG.voteInfo(0) }); return; }
  if (sPhase !== 'play') return;
  if (m.t === 'in') SG.setInput(0, m.x, m.y); else if (m.t === 'drop') SG.drop(0); else if (m.t === 'power') SG.usePower(0, m.i | 0);
}
function soloLoop() {
  if (!SG) return;
  const now = performance.now(); let dt = (now - sLast) / 1000; sLast = now; dt = Math.min(dt, 0.25);
  if (sPhase === 'reveal') { if (now >= sRevealEnd) { SG.pickCaptains(); sPhase = 'play'; S.phase = 'play'; onMsg({ t: 'go', caps: SG.captain.slice() }); } return; }
  if (sPhase !== 'play') return;
  sAcc += dt;
  while (sAcc >= 0.05) {
    sAcc -= 0.05;
    for (const b of SBOTS) b.tick(0.05);
    SG.update(0.05);
    if (SG.over) { sPhase = 'over'; onMsg(SG.snapshot(0)); onMsg({ t: 'over', result: SG.result() }); $('quitBtn').classList.add('hide'); return; }
    if (++sTick % 2 === 0) { onMsg(SG.snapshot(0)); SG.events.length = 0; }
  }
}
setInterval(soloLoop, 25);
$('menuBtn').addEventListener('click', () => { SG = null; sPhase = 'idle'; soloMenu(); });
$('quitBtn').addEventListener('click', () => { SG = null; sPhase = 'idle'; $('quitBtn').classList.add('hide'); $('reveal').classList.add('hide'); soloMenu(); });
window.__solo = { get SG() { return SG; }, get phase() { return sPhase; } };
