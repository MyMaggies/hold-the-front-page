HOLD THE FRONT PAGE  -  5v5 capture-the-flag with four game modes (Fact/Opinion, Tabloid/Broadsheet, two 4-desk device sets)

TRY IT FIRST (no setup): open public/solo.html in any browser (or on an iPad). One player + bots,
choose team size, mode, bot skill, powers on/off. Rebuild after editing the game:  python3 tools/build_solo.py

RULES (what kids see)
- CAPTAIN VOTE: the 10-second countdown at the start; each team votes for a teammate (most votes wins, ties drawn at random). Only the captain gets RADAR, 5 of them (rules.captainRadars in src/game.js). Captains wear a crown.
- 60-second EXPLORE warm-up first: walk around freely (no cards, tags or powers) to find the portals and card spawn spots. The rules are shown on screen.
- TEAMS: HERALD = red, GAZETTE = blue. Everyone on a team is the same colour.
- Pick a ROLE in the lobby: ATTACKER (BLAST + NET) or DEFENDER (SHIELD + SNIP). Everyone also starts with THREE SPRINTs. Hold up to 7 powers. Tap a power (or keys 1-7).
    SPRINT fast for 3s | SHIELD blocks one steal | SNIP cuts 8s off being tied up | BLAST freezes enemies within about 3 tiles for 2.5s | NET freezes the nearest enemy (carriers first) up to 6 tiles away for 3s | RADAR (captain only) marks every enemy for 5s.
    New pickups appear about every 7s in the dead-end corridors off the middle.
- URGENCY: when an enemy picks up a card, a siren, a toast and a pulsing "ENEMY CARRYING n" chip warn your team (never where). The minimap shows enemies only near your team or while RADAR is on; RADAR also rings carriers "HAS A CARD".
- ROLE PICKER lists each role's powers with icons and what they do.
- NAMES: students type a real name (only the teacher console shows it, as "Real Name (display)") and a display name (shown in game).
- POWER-UPS: lie in dead ends and in two supply spots at each end of your office; an arrow and the minimap point to the nearest one when you hold fewer than 3.
- Never more than 3 claim cards lying on the map (and 5 in play including carried ones), so you must fight for them. A ping ripple shows where a card spawned (never what it is).
- Carry a card into the correct editor desk in YOUR base. Right = point. Wrong = red pen: you lose the card and are stunned.
- MODES (teacher picks per table on /teacher.html, applies from the next round; solo menu has a Mode row): FO = Fact/Opinion (2 desks), TB = Tabloid/Broadsheet (2 desks, judged by STYLE not topic), D1 = Alliteration/Hyperbole/Pun/Question (4 desks), D2 = Allusion/Slang/Rhyme/Statistics (4 desks). Every card has exactly one right answer; device headlines use one device only. Banks live in src/cards.js.
- Touch an enemy carrier and you steal their card; they are TIED UP for 15s (free on their own after that, sooner if a free teammate touches them, or use SNIP).
- RAID PORTALS (red rings): 9 per team (one right by the middle line so you can dash across when they grab a card first) - dead ends off the newsroom, tubes in the duct/stationery rooms, back of the office, and two on the newsroom floor. One-way, no cards through, 15s recharge.
- Desks (FACT north, OPINION south, in the stationery rooms) sit 15-20% in from each end of the map. Each area has its own look and a label at the bottom shows where you are.
- Cupboards hide you. Tubes teleport. Teammates close to you can read your card (shout it out!).
- Office furniture (plants, copiers, couches, water coolers, boxes, printing presses, desk clusters) is solid and blocks the way. Each team's half is washed in its colour (red HERALD left, blue GAZETTE right), strongest at home, with coloured wall trim, desk outlines and couches.
- FOG OF WAR is off by default (everyone sees the whole map; hidden players are still hidden). Turn it on with rules.fog = true (src/game.js RULES, or the Fog option in solo). RADAR then marks every enemy with a ring/arrow for 5s.
- Walls: you slide along walls and corners instead of sticking.
- First to the target score wins (14 / 17 / 20 depending on table size; 5v5 plays to 20), or highest at the clock.

DEPLOY (Cloudflare, GitHub import): Root directory = hold-the-front-page, deploy command  npx wrangler deploy
Student page: /      Teacher page: /teacher.html (key in wrangler.toml TEACHER_KEY, default "duncan")
Tables A-D are separate rooms. Teacher can START NOW, RESET and pick the MODE (/ctl/<table>?cmd=mode&v=fo|tb|d1|d2&key=...).
Tests: npm test (rules + bot sims). Files: src/ (server rules), public/ (client), tools/ (solo builder), test/.
