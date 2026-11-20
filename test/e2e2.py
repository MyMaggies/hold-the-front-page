import asyncio, json, random, sys
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:8787/'
CLS = json.load(open('/tmp/cardclass.json'))
HELPER = """
() => { if (window.__dir) return;
  window.__dirp = import('./shared.js').then(m => {
    const {MAP, W, H, solid} = m;
    window.__dir = (tx, ty, px, py) => {
      const d = new Int16Array(W*H).fill(-1); const q = [[Math.floor(tx), Math.floor(ty)]]; d[q[0][1]*W+q[0][0]] = 0;
      for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx=x+dx, ny=y+dy; if (solid(nx,ny)||d[ny*W+nx]>=0) continue; d[ny*W+nx]=d[y*W+x]+1; q.push([nx,ny]); } }
      const cx=Math.floor(px), cy=Math.floor(py); let bd=d[cy*W+cx], bx=cx, by=cy;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx=cx+dx, ny=cy+dy; if (solid(nx,ny)) continue; const v=d[ny*W+nx]; if (v>=0&&v<bd){bd=v;bx=nx;by=ny;} }
      const vx=bx+.5-px, vy=by+.5-py, l=Math.hypot(vx,vy)||1; return (bx===cx&&by===cy)?[0,0]:[vx/l,vy/l];
    };
    window.__desks = MAP.desks;
  });
}
"""
async def drive(pg, idx, secs, wrong_rate=0.2):
    await pg.evaluate(HELPER); await pg.evaluate('window.__dirp')
    await pg.mouse.move(150, 560); await pg.mouse.down()
    end = asyncio.get_event_loop().time() + secs
    kind_cycle = ['F','O']
    while asyncio.get_event_loop().time() < end:
        s = await pg.evaluate('({x:__S.me.x,y:__S.me.y,car:__S.carrying,ct:__S.ct,cards:__S.cards,team:__S.team,tied:__S.tied,pw:__S.pw,tm:Object.entries(__S.disp).filter(([id,o])=>__S.players[id]&&__S.players[id].team===__S.team&&o.t&&performance.now()-o.seen<600).map(([id,o])=>[o.x,o.y]),en:Object.entries(__S.disp).filter(([id,o])=>__S.players[id]&&__S.players[id].team!==__S.team&&o.c&&performance.now()-o.seen<400).map(([id,o])=>[o.x,o.y]),stun:__S.stun,phase:__S.phase,screen:__S.screen})')
        if s['screen'] != 'game' or s['phase'] == 'over': break
        tgt = None
        if s['tied']:
            await pg.mouse.move(150, 560); await asyncio.sleep(0.2); continue
        if s['pw'] and (s['en'] or (s['car'] and random.random() < 0.05)): await pg.keyboard.press('e')
        if s['car'] and s['ct']:
            k = CLS.get(s['ct'], 'F')
            if random.random() < 0.002 * wrong_rate * 10: k = 'O' if k == 'F' else 'F'
            ds = await pg.evaluate('__desks')
            d = [d for d in ds if d['team'] == s['team'] and d['kind'] == k][0]
            tgt = ((d['x0']+d['x1'])/2, (d['y0']+d['y1'])/2)
        elif s['tm']:
            tgt = tuple(s['tm'][0])
        elif s['en']:
            tgt = tuple(min(s['en'], key=lambda e: (e[0]-s['x'])**2+(e[1]-s['y'])**2))
        elif s['cards']:
            c = min(s['cards'], key=lambda c: (c[1]-s['x'])**2 + (c[2]-s['y'])**2); tgt = (c[1], c[2])
        if tgt and s['stun'] <= 0:
            v = await pg.evaluate('([a,b,c,d]) => __dir(a,b,c,d)', [tgt[0], tgt[1], s['x'], s['y']])
            await pg.mouse.move(150 + v[0]*55, 560 + v[1]*55)
        else:
            await pg.mouse.move(150, 560)
        await asyncio.sleep(0.12)
    await pg.mouse.up()
async def main():
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pages = []; errs = []
        for i in range(N):
            ctx = await b.new_context(viewport={'width': 1024, 'height': 700})
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, i=i: errs.append((i, str(e))))
            await pg.goto(URL + '?x=' + str(i)); await pg.click('.tbtn[data-t="B"]')
            await pg.fill('#nameIn', f'Kid{i}'); await pg.click('#joinBtn'); pages.append(pg)
        await asyncio.sleep(1); 
        for pg in pages: await pg.click('#readyBtn')
        await asyncio.sleep(7.5)
        asyncio.get_event_loop().call_later(15, lambda: asyncio.ensure_future(pages[1].evaluate('__ws_kill()')))
        tasks = [asyncio.create_task(drive(pg, i, 80)) for i, pg in enumerate(pages)]
        shots = 0
        for _ in range(80):
            await asyncio.sleep(1)
            for i, pg in enumerate(pages):
                try:
                    car = await pg.evaluate('__S.carrying')
                    fb = await pg.evaluate("!document.getElementById('fb').classList.contains('hide')")
                    tied = await pg.evaluate('__S.tied')
                    if tied and not globals().get('TSHOT'):
                        globals()['TSHOT'] = True; await pg.screenshot(path='/tmp/shots/tied.png')
                except Exception: continue
                if fb and shots < 4:
                    await pg.screenshot(path=f'/tmp/shots/fb{shots}.png'); shots += 1
                elif car and shots == 0 and i == 0:
                    await pg.screenshot(path='/tmp/shots/carry.png')
            st = await pages[0].evaluate('({sc:__S.score, ph:__S.phase, scr:__S.screen})')
            if st['ph'] == 'over': break
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.sleep(1)
        print('final', await pages[0].evaluate('({sc:__S.score, ph:__S.phase, scr:__S.screen})'))
        await pages[0].screenshot(path='/tmp/shots/over.png')
        print('events', [await pg.evaluate('__S.evc') for pg in pages[:4]])
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
