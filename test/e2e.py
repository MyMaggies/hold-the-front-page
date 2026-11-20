import asyncio, json, sys, time
from playwright.async_api import async_playwright
URL = 'http://127.0.0.1:8787/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pages = []; errs = []
        for i in range(6):
            ctx = await b.new_context(viewport={'width': 1024, 'height': 700}, has_touch=True)
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, i=i: errs.append((i, str(e))))
            pg.on('console', lambda m, i=i: errs.append((i, m.text)) if m.type == 'error' else None)
            await pg.goto(URL)
            await pg.fill('#nameIn', f'Kid{i}')
            await pg.click('#joinBtn')
            pages.append(pg)
        await asyncio.sleep(1.0)
        await pages[0].screenshot(path='/tmp/shots/lobby.png')
        for pg in pages: await pg.click('#readyBtn')
        await asyncio.sleep(1.5)
        await pages[0].screenshot(path='/tmp/shots/reveal.png')
        await asyncio.sleep(6.5)
        # all walk toward the middle with the keyboard (right for team 0, left for team 1)
        async def team(pg): return await pg.evaluate('window.__S.team')
        teams = [await team(pg) for pg in pages]
        print('teams', teams)
        for pg, t in zip(pages, teams):
            await pg.keyboard.down('d' if t == 0 else 'a')
        await asyncio.sleep(5.0)
        await pages[0].screenshot(path='/tmp/shots/play1.png')
        for pg in pages: await pg.keyboard.up('d'); await pg.keyboard.up('a')
        st = await pages[0].evaluate('({me:window.__S.me, carrying:window.__S.carrying, cards:window.__S.cards.length, score:window.__S.score, phase:window.__S.phase})')
        print('state', st)
        print('status', await pages[0].evaluate("fetch('/status/A').then(r=>r.json())"))
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
