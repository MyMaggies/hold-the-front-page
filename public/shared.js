// Hold the Front Page: shared rules, map and movement.
// This file is loaded by BOTH the server (src/game.js) and the iPad page, so
// the joystick feels the same everywhere. It must contain no answers to cards.

export const W = 72, H = 36;          // map size in tiles (left half is team 0, right half is team 1)
export const T = { WALL: 0, FLOOR: 1, DESK: 2, CUPBOARD: 3, TUBE: 4 };

export const CFG = {
  speed: 3.6,          // tiles per second
  carryMult: 0.88,     // carrying a card slows you a little
  sprintMult: 1.6,     // SPRINT power
  sprintSecs: 3,
  shieldSecs: 8,       // SHIELD power: absorbs one tag
  shieldStun: 1.0,     // a tagger who hits a shield is stunned this long
  radius: 0.32,        // body size in tiles
  vis: 7.5,            // how far you can see (tiles)
  tagDist: 0.85,       // an enemy this close to a card carrier tags them
  rescueDist: 0.95,    // a free teammate this close unties a tied-up player
  foundDist: 1.25,     // an enemy this close finds a hidden player
  stunSecs: 2.4,       // wrong desk = red pen
  graceSecs: 2.0,      // can't be tagged again straight after being freed
  stealGrace: 1.5,     // a thief can't be tagged straight back
  hideSecs: 0.6,       // stand still in a cupboard this long to hide
  pickLock: 1.5,       // after dropping a card you can't pick it straight back up
  teammateRead: 3.2,   // teammates this close can read the card you carry
  tiedSecs: 15,        // tied up this long, then you break free by yourself (a teammate can free you sooner)
  snipSecs: 8,         // SNIP power takes this much off the time you are tied up
  blastR: 3.2,         // BLAST power freezes enemies this close
  freezeSecs: 2.5,
  netR: 6.5,           // NET power reaches this far
  netSecs: 3,          // ...and freezes its target this long
  radarSecs: 5,        // RADAR power shows every enemy to your team
  maxPowers: 7,        // how many powers you can hold
};

// GAME MODES. Desks have fixed SLOT letters (F north, I and L forward desks, O south); each mode gives the slots new names.
export const MODES = {
  fo: { name: 'FACT or OPINION', kinds: ['F', 'O'],
        rule: 'FACT = you could check it, even "she said...". OPINION = a view, prediction or "should", even if it has numbers in it.',
        names: { F: { name: 'FACT', sub: 'can be checked' }, O: { name: 'OPINION', sub: "can't be checked" } } },
  tb: { name: 'TABLOID or BROADSHEET', kinds: ['F', 'O'],
        rule: 'Judge the STYLE of the headline, not the topic. TABLOID = punchy, dramatic, playful or emotive. BROADSHEET = formal, plain, factual.',
        names: { F: { name: 'TABLOID', sub: 'punchy and dramatic' }, O: { name: 'BROADSHEET', sub: 'formal and factual' } } },
  d1: { name: 'DEVICES 1', kinds: ['F', 'I', 'L', 'O'],
        rule: 'Each headline uses ONE device. Alliteration = repeated first sound. Hyperbole = huge exaggeration. Pun = word-play joke. Question = asked for effect.',
        names: { F: { name: 'ALLITERATION', sub: 'same first sound' }, I: { name: 'HYPERBOLE', sub: 'big exaggeration' }, L: { name: 'PUN', sub: 'word-play joke' }, O: { name: 'QUESTION', sub: 'asked for effect' } } },
  d2: { name: 'DEVICES 2', kinds: ['F', 'I', 'L', 'O'],
        rule: 'Each headline uses ONE device. Allusion = nod to something famous. Slang = informal words. Rhyme = matching sounds. Stats = numbers as evidence.',
        names: { F: { name: 'ALLUSION', sub: 'famous reference' }, I: { name: 'SLANG', sub: 'informal words' }, L: { name: 'RHYME', sub: 'matching sounds' }, O: { name: 'STATS', sub: 'numbers as proof' } } },
};
export const MODE_KEYS = ['fo', 'tb', 'd1', 'd2'];

// (old names, kept so nothing else breaks)
export const KINDS = {
  F: { name: 'FACT', sub: 'can be checked', level: 1 },
  O: { name: 'OPINION', sub: 'someone\'s view', level: 1 },
  I: { name: 'INFORMED', sub: 'opinion + evidence', level: 2 },
  L: { name: 'LOADED', sub: 'sneaky words', level: 2 },
};
export const DESK_CHAR = { f: 'F', o: 'O', i: 'I', l: 'L' };
export const POWERS = {
  S: { name: 'SPRINT', col: '#ffd23f', icon: '💨', tip: 'run fast for 3s' },
  H: { name: 'SHIELD', col: '#4fc3f7', icon: '🛡️', tip: 'blocks one tag' },
  B: { name: 'SNIP', col: '#ff9f43', icon: '✂️', tip: 'break free faster when tied' },
  Z: { name: 'BLAST', col: '#b388ff', icon: '❄️', tip: 'freezes enemies near you' },
  R: { name: 'RADAR', col: '#69f0ae', icon: '📡', tip: 'captain only: marks every enemy for 5s' },
  N: { name: 'NET', col: '#ff6bd6', icon: '🕸️', tip: 'freezes the nearest enemy up to 6 tiles away' },
};
export const POWER_KEYS = ['S', 'H', 'B', 'Z', 'N'];   // what can lie on the floor (RADAR is the captain's alone)

/* ---------- the map ---------- */
// Built for the top-left quarter, then mirrored down (north/south) and across (left/right team), so it is fair.
//   BASE (x3-9) -> north/south STATIONERY ROOMS hold desk F (north corner) and desk O (south corner).
//   Level 2 adds FORWARD DESKS I and L, in the long 1-wide DUCTS (y=1 and y=34), well away from the base.
//   So a carrier has to choose a direction, and paths cross all over the map.
//   PRESS HALL (x12-24) is a grid of 2-3 wide lanes around pillars. NEWSROOM (x26-35) is the card zone.
//   DEAD ENDS: 1-wide corridors 5 deep off the newsroom, some with power-ups and some with cupboards.
//   RAID PORTALS (red) sit at the end of the dead ends at x31. One-way trip to the enemy duct near THEIR forward desk.
function buildMap() {
  const half = 36;
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(half).fill(T.WALL));
  const rect = (x0, y0, x1, y1, t = T.FLOOR) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = t; };
  const wall = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, T.WALL);
  const put = (x, y, t) => { g[y][x] = t; };

  // ---- top-left quarter (y 0-17); the bottom is a mirror image ----
  // base and doors
  rect(3, 13, 9, 17);
  rect(6, 10, 7, 12);                       // north door of the base (2 wide)
  rect(10, 15, 11, 16);                     // east door to the hall (2 wide)
  // stationery room (north), partition walls, desk F alcove on its west wall
  rect(3, 3, 9, 9); wall(5, 7, 5, 9); wall(7, 3, 7, 5);
  rect(10, 3, 11, 4, T.DESK);               // desk F: east wall of the stationery room (reach it through the room)
  put(3, 3, T.CUPBOARD); put(9, 9, T.CUPBOARD);
  put(4, 4, T.TUBE);                        // raid portal BEHIND desk F
  put(3, 16, T.TUBE);                       // raid portal at the back of the office
  // a 1-wide side passage from the room straight to the hall
  rect(10, 6, 12, 6); rect(12, 7, 12, 7);
  // north duct (1 wide, long), forward desk I alcove under it, and the way down into the hall
  rect(8, 1, 22, 1); put(8, 2, T.FLOOR);
  rect(10, 11, 11, 12, T.DESK);             // forward desk (slot I): off the west lane of the press hall, used in the 4-desk modes
  put(17, 1, T.CUPBOARD);
  rect(22, 2, 22, 7);
  // press hall: lanes between pillar blocks
  rect(12, 8, 24, 17);
  wall(14, 10, 16, 12); wall(19, 10, 21, 12); wall(14, 15, 16, 17); wall(19, 15, 21, 17);
  put(12, 9, T.CUPBOARD); put(24, 14, T.CUPBOARD);
  // deep dead end off the hall
  rect(24, 3, 24, 7);
  // three openings from the hall to the newsroom (2 wide)
  rect(25, 9, 25, 10); rect(25, 17, 25, 17);
  // newsroom (cards appear here) with pillars
  rect(26, 6, 35, 17);
  wall(28, 9, 29, 11); wall(32, 9, 33, 11); wall(29, 15, 30, 17); wall(34, 15, 35, 17);
  put(26, 12, T.TUBE);                      // raid portal on the newsroom floor, easy to reach
  put(34, 13, T.TUBE);                      // raid portal right by the middle line: dash across when you see they got a card first
  put(26, 6, T.CUPBOARD); put(35, 8, T.CUPBOARD); put(35, 13, T.CUPBOARD);
  // dead-end corridors north of the newsroom: 5 deep, 1 wide
  rect(27, 1, 27, 5);                       // power-up at the end
  rect(31, 1, 31, 5); put(31, 1, T.TUBE);   // RAID portal at the end
  rect(34, 1, 34, 5); put(34, 1, T.CUPBOARD);   // hideout at the end
  rect(29, 3, 29, 5);                       // short bay with a power-up
  put(29, 5, T.FLOOR);

  // mirror the top quarter down
  for (let y = 0; y < 18; y++) g[H - 1 - y] = g[y].slice();

  // assemble the full map by mirroring left to right
  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = new Array(W).fill(T.WALL);
    for (let x = 0; x < half; x++) { row[x] = g[y][x]; row[W - 1 - x] = g[y][x]; }
    grid.push(row);
  }
  // desks
  const deskHalf = [['f', 10, 3, 12, 5], ['i', 10, 11, 12, 13], ['l', 10, 23, 12, 25], ['o', 10, 31, 12, 33]];
  const desks = [];
  for (let team = 0; team < 2; team++) {
    for (const [c, x0, y0, x1, y1] of deskHalf) {
      desks.push({ team, kind: DESK_CHAR[c], x0: team === 0 ? x0 : W - x1, y0, x1: team === 0 ? x1 : W - x0, y1 });
    }
  }
  // portals. RAID portals are one way: from your dead end to the enemy duct. You cannot take a card through.
  const tubes = [];
  const raid = (x, y, tx, ty) => tubes.push({ x, y, to: [tx, ty], raid: true });
  // [portal x, portal y, landing x, landing y] for the left team; the right team gets the mirror image.
  // Landing spots are in the ENEMY half (so x is given as it would be in the left half, then mirrored across).
  const raids = [
    [31, 1, 19, 1], [31, 34, 19, 34],      // dead ends off the newsroom -> enemy air duct
    [4, 4, 5, 4], [4, 31, 5, 31],          // behind desks F / O -> enemy stationery room, behind THEIR desk
    [3, 16, 5, 16], [3, 19, 5, 19],        // back of the office -> enemy office
    [26, 12, 17, 13], [26, 23, 17, 22],    // newsroom floor -> enemy press hall lane
    [34, 13, 13, 14], [34, 22, 13, 21],    // by the middle line -> enemy hall, right outside THEIR office
  ];
  for (const [x, y, tx, ty] of raids) { raid(x, y, W - 1 - tx, ty); raid(W - 1 - x, y, tx, ty); }
  // card spawn points: only in the newsroom
  const spawnHalf = [[28, 7], [31, 7], [27, 13], [27, 22], [28, 28], [31, 28], [35, 12], [35, 23], [31, 13], [31, 22], [28, 17], [34, 8], [34, 27]];
  const spawns = [];
  for (const [x, y] of spawnHalf) { spawns.push([x + 0.5, y + 0.5]); spawns.push([W - 1 - x + 0.5, y + 0.5]); }
  // power-up spots: ends of dead ends
  const powerHalf = [[27, 1], [27, 34], [29, 3], [29, 32], [24, 3], [24, 32], [9, 14], [9, 21], [13, 9], [13, 26]];   // last four: supply spots in your own office and just outside it
  const powerSpots = [];
  for (const [x, y] of powerHalf) { powerSpots.push([x + 0.5, y + 0.5]); powerSpots.push([W - 1 - x + 0.5, y + 0.5]); }
  // player start spots inside each base (up to 10 per team)
  const starts = [[], []];
  for (let i = 0; i < 10; i++) {
    const x = 4.5 + (i >= 5 ? 2.5 : 0), y = 14.5 + (i % 5) * 1.8;
    starts[0].push([x, y]); starts[1].push([W - x, y]);
  }
  // zone map: used by the page to decorate each area differently and to say where you are
  const zoneOfTile = (x, y) => {
    const a = Math.min(x, W - 1 - x), b = Math.min(y, H - 1 - y);
    if (grid[y][x] === T.DESK) return 'desk';
    if ((a === 27 || a === 31 || a === 34) && b <= 5) return 'dead';
    if (a === 29 && b >= 3 && b <= 5) return 'dead';
    if (a === 24 && b >= 3 && b <= 7) return 'dead';
    if ((b === 1 && a >= 8 && a <= 22) || (a === 8 && b === 2) || (a === 22 && b >= 2 && b <= 7)) return 'duct';
    if (a >= 3 && a <= 9 && b >= 3 && b <= 9) return 'stat';
    if (b === 6 && a >= 10 && a <= 12) return 'stat';
    if (a === 12 && b === 7) return 'stat';
    if (a >= 3 && a <= 11 && b >= 10) return 'base';
    if (a >= 12 && a <= 25) return 'hall';
    return 'news';
  };
  const zone = [];
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(grid[y][x] === T.WALL ? '' : zoneOfTile(x, y)); zone.push(row); }
  const cupboards = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === T.CUPBOARD) cupboards.push([x, y]);
  // ---- office furniture: solid props (plants, copiers, couches...) that block the way. ----
  // Listed for the top-left quarter, then mirrored. A prop is skipped if it would sit on something
  // important (spawns, power spots, starts, portals and their landings) or would cut the map in two.
  const props = {};                                   // "x,y" -> kind
  const keep = [...spawns, ...powerSpots, ...starts[0], ...starts[1]].map(([x, y]) => [Math.floor(x), Math.floor(y)]);
  for (const t of tubes) { keep.push([t.x, t.y], [t.to[0], t.to[1]]); }
  const nearKeep = (x, y) => keep.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) <= 1 && (Math.abs(a - x) + Math.abs(b - y) === 0 || tubes.some((t) => (t.x === a && t.y === b) || (t.to[0] === a && t.to[1] === b))));
  const connected = () => {
    const seen = new Set(['5,14']), q = [[5, 14]];
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || grid[ny][nx] === T.WALL || seen.has(nx + ',' + ny)) continue; seen.add(nx + ',' + ny); q.push([nx, ny]); } }
    let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] !== T.WALL) n++;
    return seen.size === n;
  };
  const place = (cells) => {     // cells: [[x, y, kind], ...] in left-half coordinates; mirrors four ways
    const sets = [];
    for (const mx of [0, 1]) for (const my of [0, 1]) sets.push(cells.map(([x, y, k]) => [mx ? W - 1 - x : x, my ? H - 1 - y : y, mx && k === 'couchL' ? 'couchR' : mx && k === 'couchR' ? 'couchL' : k]));
    for (const set of sets) {
      if (!set.every(([x, y]) => grid[y][x] === T.FLOOR && !nearKeep(x, y))) continue;
      for (const [x, y] of set) grid[y][x] = T.WALL;
      if (!connected()) { for (const [x, y] of set) grid[y][x] = T.FLOOR; continue; }
      for (const [x, y, k] of set) props[x + ',' + y] = k;
    }
  };
  const one = (x, y, k) => place([[x, y, k]]);
  const couch = (x, y) => place([[x, y, 'couchL'], [x + 1, y, 'couchR']]);
  // the office (your base)
  one(3, 13, 'plant'); one(9, 13, 'plant'); couch(4, 13); one(3, 15, 'cooler'); one(9, 17, 'copier'); one(3, 17, 'bin');
  // stationery rooms
  one(3, 5, 'plant'); one(3, 8, 'plant'); one(9, 7, 'copier'); one(6, 9, 'boxes'); one(8, 5, 'boxes'); one(4, 6, 'bin');
  // press hall
  one(12, 17, 'plant'); one(24, 9, 'plant'); one(24, 17, 'plant'); one(22, 8, 'boxes');
  // newsroom floor
  one(26, 7, 'plant'); one(35, 7, 'plant'); couch(32, 6); couch(26, 16); one(35, 17, 'copier'); one(31, 17, 'cooler'); one(27, 10, 'bin'); one(34, 12, 'boxes');
  return { W, H, grid, zone, desks, tubes, spawns, powerSpots, starts, cupboards, props };
}
export const ZONES = {
  base:  { name: 'THE OFFICE',      col: '#d9b86c' },
  stat:  { name: 'STATIONERY ROOM', col: '#7fbf7f' },
  duct:  { name: 'AIR DUCT',        col: '#8a93a8' },
  hall:  { name: 'PRESS HALL',      col: '#c28a5a' },
  news:  { name: 'NEWSROOM FLOOR',  col: '#6f93d6' },
  dead:  { name: 'DEAD END',        col: '#8c5cc9' },
  desk:  { name: 'EDITOR DESK',     col: '#e0e0e0' },
};
export const MAP = buildMap();
export const zoneAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return cx < 0 || cy < 0 || cx >= W || cy >= H ? '' : MAP.zone[cy][cx]; };

export const cellAt = (x, y) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return T.WALL;
  return MAP.grid[cy][cx];
};
export const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= W || cy >= H || MAP.grid[cy][cx] === T.WALL;

// Move a circle through the grid. p has x, y. dx,dy is the joystick direction (length 0..1).
// The circle moves, then is pushed back out of any wall it overlaps. That makes it slide smoothly
// along walls and round corners instead of sticking to them.
export function step(p, dx, dy, dt, speed) {
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return false;
  if (len > 1) { dx /= len; dy /= len; }
  const R = CFG.radius;
  const x0 = p.x, y0 = p.y, mx = dx * speed * dt, my = dy * speed * dt;
  // push a circle at (nx,ny) out of any wall it overlaps
  const resolve = (nx, ny) => {
    for (let iter = 0; iter < 4; iter++) {
      let hit = false;
      const ax = Math.floor(nx - R), bx = Math.floor(nx + R), ay = Math.floor(ny - R), by = Math.floor(ny + R);
      for (let cy = ay; cy <= by; cy++) for (let cx = ax; cx <= bx; cx++) {
        if (!solid(cx, cy)) continue;
        const qx = Math.max(cx, Math.min(nx, cx + 1)), qy = Math.max(cy, Math.min(ny, cy + 1));
        const ex = nx - qx, ey = ny - qy, d2 = ex * ex + ey * ey;
        if (d2 >= R * R) continue;
        hit = true;
        if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (R - d) / d; nx += ex * k; ny += ey * k; }
        else {   // centre is inside the wall: leave by the nearest edge
          const l = nx - cx, r = cx + 1 - nx, t = ny - cy, b = cy + 1 - ny, m = Math.min(l, r, t, b);
          if (m === l) nx = cx - R; else if (m === r) nx = cx + 1 + R; else if (m === t) ny = cy - R; else ny = cy + 1 + R;
        }
      }
      if (!hit) break;
    }
    if (solid(Math.floor(nx), Math.floor(ny))) return [x0, y0];   // never end up inside a wall
    return [nx, ny];
  };
  let [nx, ny] = resolve(x0 + mx, y0 + my);
  // pushing straight into a pillar corner can cancel the whole move: then try each axis on its own so you slip round it
  const intended = Math.hypot(mx, my);
  if (Math.hypot(nx - x0, ny - y0) < intended * 0.35) {
    const ax = resolve(x0 + mx, y0), ay = resolve(x0, y0 + my);
    const da = Math.hypot(ax[0] - x0, ax[1] - y0), db = Math.hypot(ay[0] - x0, ay[1] - y0), dm = Math.hypot(nx - x0, ny - y0);
    if (da >= db && da > dm) [nx, ny] = ax; else if (db > dm) [nx, ny] = ay;
  }
  p.x = nx; p.y = ny;
  return Math.hypot(nx - x0, ny - y0) > 0.002;
}

// Can (x0,y0) see (x1,y1)? Only walls block sight.
export function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 0.25));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (solid(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
  }
  return true;
}

export const deskOf = (x, y) => {
  for (const d of MAP.desks) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return null;
};

export const TEAMS = [
  { name: 'HERALD', color: '#ff2b2b', dark: '#8a1010' },    // bright red
  { name: 'GAZETTE', color: '#1f6bff', dark: '#0f2f8a' },   // stark blue
];
// Roles chosen in the lobby. Everyone gets three SPRINTs; the role adds two more powers.
export const ROLES = {
  A: { name: 'ATTACKER', icon: '⚔️', kit: ['Z', 'N'], tip: 'BLAST + NET: freeze enemies and steal their cards' },
  D: { name: 'DEFENDER', icon: '🛡️', kit: ['H', 'B'], tip: 'SHIELD + SNIP: guard your carriers, escape ropes' },
};
export const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da', '#ec407a', '#d4e157', '#8d6e63', '#78909c'];
