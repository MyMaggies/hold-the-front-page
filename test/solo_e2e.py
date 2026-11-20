import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1180,'height':820})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto('file:///home/claude/hold-the-front-page/public/solo.html')
        await pg.screenshot(path='/tmp/e_menu.png')
        await pg.click('#soloPlay'); await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/e_reveal.png')
        await pg.wait_for_timeout(6500); await pg.screenshot(path='/tmp/e_explore.png')
        await pg.evaluate("(()=>{const g=window.__solo.SG;const p=g.players[0];p.x=(p.team===0?26.5:45.5);p.y=12.5;})()")
        await pg.wait_for_timeout(800); await pg.screenshot(path='/tmp/e_portal.png')
        await pg.wait_for_timeout(26000)
        print(await pg.evaluate("(()=>{const g=window.__solo.SG;return {ex:g.exploreT,floor:g.floor.length,pw:g.players[0].powers}})()"))
        await pg.screenshot(path='/tmp/e_play.png')
        await pg.wait_for_timeout(15000)
        print(await pg.evaluate("window.__solo.SG.floor.length"), errs); await b.close()
asyncio.run(main())
