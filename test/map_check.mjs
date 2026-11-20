import { MAP, W, H, T, solid, CFG } from '../public/shared.js';
const ch = { [T.WALL]: '#', [T.FLOOR]: '.', [T.DESK]: 'D', [T.CUPBOARD]: 'c', [T.TUBE]: 'O' };
const rows = MAP.grid.map(r => r.map(v => ch[v]));
MAP.spawns.forEach(([x, y]) => { rows[Math.floor(y)][Math.floor(x)] = '*'; });
MAP.powerSpots.forEach(([x, y]) => { rows[Math.floor(y)][Math.floor(x)] = 'P'; });
MAP.starts.forEach(a => a.forEach(([x, y]) => { rows[Math.floor(y)][Math.floor(x)] = 'S'; }));
console.log(rows.map(r => r.join('')).join('\n'));
// flood fill from a start
const seen = new Set(); const q = [[5, 12]]; seen.add("5,12");
while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; if (solid(nx, ny) || seen.has(nx+','+ny)) continue; seen.add(nx+','+ny); q.push([nx, ny]); } }
let walk = 0, unreach = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y)) { walk++; if (!seen.has(x+','+y)) unreach.push([x, y]); }
console.log('walkable', walk, 'unreachable', unreach.length, unreach.slice(0, 5));
// spawn distance from every desk
let minD = 99; for (const [sx, sy] of MAP.spawns) for (const d of MAP.desks) { const cx = Math.max(d.x0, Math.min(sx, d.x1)), cy = Math.max(d.y0, Math.min(sy, d.y1)); minD = Math.min(minD, Math.hypot(sx-cx, sy-cy)); }
console.log('min spawn->desk distance', minD.toFixed(1));
// tubes sanity
for (const t of MAP.tubes) { if (solid(t.x, t.y) || solid(t.to[0], t.to[1])) console.log('bad tube', t); }
for (const [x, y] of [...MAP.spawns, ...MAP.powerSpots]) if (solid(Math.floor(x), Math.floor(y))) console.log('SPAWN IN WALL', x, y);
console.log('tubes', MAP.tubes.length, 'cupboards', MAP.cupboards.length, 'desks', MAP.desks.length);
// start tiles walkable
for (const a of MAP.starts) for (const [x, y] of a) if (solid(Math.floor(x), Math.floor(y))) console.log('bad start', x, y);
// symmetry
let asym = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP.grid[y][x] !== MAP.grid[y][W-1-x]) asym++;
console.log('asymmetric cells', asym);
