#!/usr/bin/env python3
"""Builds ONE self-contained HTML file for practising against bots (no server, no Cloudflare).
Run from the project folder:   python3 tools/build_solo.py
It reads the real game files (public/shared.js, src/cards.js, src/game.js, test/bots.mjs and
public/index.html), so every change you make to the real game shows up in the solo version
after you rebuild.   Output: public/solo.html"""
import re, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()

def wrap(name, src, deps):
    """turn an ES module into a function that returns its exports"""
    exports = []
    for m in re.finditer(r'^export\s+(?:const|let|function|class)\s+([A-Za-z0-9_$]+)([^;\n]*)', src, re.M):
        exports.append(m.group(1))
        if m.group(0).split()[1] in ('const', 'let') and '=>' not in m.group(2) and '(' not in m.group(2) and '{' not in m.group(2):
            exports += re.findall(r',\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=', m.group(2))
    def imp(m):
        names, frm = m.group(1), m.group(2)
        dep = next(d for k, d in deps.items() if frm.endswith(k))
        return f'const {{{names}}} = {dep};'
    src = re.sub(r"^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?\s*$", imp, src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    return f'const {name} = (() => {{\n{src}\nreturn {{{", ".join(exports)}}};\n}})();\n'

shared = wrap('__shared', rd('public/shared.js'), {})
cards = wrap('__cards', rd('src/cards.js'), {'shared.js': '__shared'})
game = wrap('__game', rd('src/game.js'), {'shared.js': '__shared', 'cards.js': '__cards'})
bots = wrap('__bots', rd('test/bots.mjs'), {'shared.js': '__shared'})

html = rd('public/index.html')
m = re.search(r'<script type="module">(.*)</script>', html, re.S)
client = m.group(1)
imp = re.search(r"import\s*\{([^}]*)\}\s*from\s*'\./shared\.js';", client)
client = client.replace(imp.group(0), f'const {{{imp.group(1)}}} = __shared;\nconst {{ Game, RULES, scaledRules }} = __game;\nconst {{ Bot }} = __bots;')

def sub(a, b):
    global client
    assert a in client, 'missing: ' + a[:60]
    client = client.replace(a, b, 1)

sub('function connect() {', 'function connect() { if (window.SOLO) return soloStart();')
sub('const send = (o) => {', 'const send = (o) => { if (window.SOLO) return soloSend(o);')
sub("for (const id of ['join', 'lobby', 'over'])", "for (const id of ['join', 'solo', 'lobby', 'over'])")
sub('buildJoin(); resize(); requestAnimationFrame(frame);', open(os.path.join(root, 'tools', 'solo_engine.js'), encoding='utf-8').read() + '\nbuildJoin(); resize(); requestAnimationFrame(frame); soloMenu();')

menu_html = open(os.path.join(root, 'tools', 'solo_menu.html'), encoding='utf-8').read()
html = html[:m.start()] + '<script>\nwindow.SOLO = true;\n' + shared + cards + game + bots + '</script>\n<script>\n(function () {\n' + client + '\n})();\n</script>' + html[m.end():]
html = html.replace('<div class="screen" id="join">', menu_html + '\n<div class="screen hide" id="join">', 1)
html = html.replace('<button class="big" id="againBtn">READY AGAIN</button>', '<button class="big" id="againBtn">PLAY AGAIN</button>\n  <button class="big" id="menuBtn" style="background:#312b57;color:#fff;box-shadow:0 5px 0 #14102a">SETTINGS</button>', 1)
html = html.replace('<title>Hold the Front Page</title>', '<title>Hold the Front Page (solo practice)</title>', 1)
out = os.path.join(root, 'public', 'solo.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
