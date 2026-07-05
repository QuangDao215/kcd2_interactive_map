# KCD2 DLC quests — name reference

Quest-name reference for the KCD2 story-expansion DLCs, to populate the DLC quest
marker classes (`quest_dlc0`–`quest_dlc3`, in the **Quests** group). The extracted
marker data had **no** DLC class originally — these names come from the
wiki/walkthroughs, not the game files this repo extracts. DLC markers are created by
**re-classing** existing `quest_side`/`quest_task` markers (matched by name) to
`quest_dlc0`–`quest_dlc3`, each `_baseKey`-pinned to its *original* class so
discovered/edit/permalink records survive.

> ⚠️ **Marker names use a curly apostrophe (U+2019 `'`), not ASCII `'`.** Match
> apostrophe-insensitively when searching the data — e.g. `Klaus' Introduction`,
> `Magdalena's Axe`, `The Master's Game`, `The Lion's Crest`. A straight-quote
> substring search silently misses them (this bit the Legacy of the Forge pass).

## Icon → DLC mapping (owner-confirmed)

The four crests are the game's internal `DLC0`–`DLC3` index. Confirmed mapping (the
category display names now use these DLC names; ids stay `quest_dlc0`–`quest_dlc3`):

| Icon | Crest | DLC |
|---|---|---|
| `DLC0_icon` | purple, white lion | **The Lion's Crest** (pre-order pack — 1 bonus quest) |
| `DLC1_icon` | purple crest | **Brushes with Death** |
| `DLC2_icon` | purple, crown | **Legacy of the Forge** |
| `DLC3_icon` | green shield, cross | **Mysteria Ecclesiae** |

## The Lion's Crest — 1 bonus quest (pre-order pack)
A treasure hunt (a riddle + 4 treasure maps). Start: speak to **Scribe Gaibl** in
**Troskowitz** (Trosky region) after the prologue. Reward: Knight Brunswick's
legendary set — poleaxe, belt dagger, full plate armour, and a horse caparison.

1. The Lion's Crest

## Brushes with Death — 10 side quests
Painter **Master Voyta** storyline.

1. A Sketchy Situation
2. Source of Inspiration
3. Chiaroscuro
4. Portrait in Red
5. The Night-Mare
6. Man Proposes
7. God Disposes
8. Stained Honour
9. Root of Evil
10. Unveiling

## Legacy of the Forge — 7 story quests + tasks
Ruined **forge in Kuttenberg** / the Blacksmiths' Guild (available after Main Quest 14).
Source nuance: **PowerPyx** counts 7 main quests (incl. Magdalena's Axe); **game-checklists**
counts 6 main + Magdalena's Axe as one of 12 tasks. Blacksmithing sketches (9) are crafting
recipes, not map quests.

**Main storyline (7)**
1. Adept
2. Magdalena's Axe   *(a task per game-checklists)*
3. The Master's Game
4. Klaus' Introduction
5. Martin's Dream   *(stored lowercase `Martin's dream` in the data)*
6. Old Plans
7. The Last Step

**Tasks / guild activities (11)**
Blacksmith's Commission · In the Service of the Guild · Herald of Kuttenberg ·
Forge Waffenrock · Fragile Delivery · Alms · Friendly Bout · Sculptor Without a Future ·
Sinners of Kuttenberg · A Pleasant Pastime · Kuttenberg Sharpshooters

**In the data — 11 markers, all re-classed to `quest_dlc2`:** Adept, Old Plans, The Last Step,
Magdalena's Axe, The Master's Game, Klaus' Introduction, Martin's dream, Forge Waffenrock,
Friendly Bout, Sculptor Without a Future, A Pleasant Pastime. The other 4 story quests and
7 tasks are **not placed** on the map.

## Mysteria Ecclesiae — 11 (6 side quests + 5 tasks)
Escort the royal physician to **Sedletz Monastery** east of Kuttenberg.
Source nuance: quest #5 is **"Our Old Bread"** (PowerPyx) / **"Our Daily Bread"**
(game-checklists) — same quest, name varies by source.

1. The Royal Physician
2. Anamnesis
3. Maddening Pain
4. Prevention
5. Our Old Bread
6. Foreseeing Evil
7. The Last Wish
8. Silent Witnesses
9. Seek and you Shall Find
10. To Dust you Shan't Return
11. The Time has Come

**In the data — only 1 marker:** `The Royal Physician`, re-classed to `quest_dlc3` (the DLC
access quest). The other 10 are **not placed** on the map. ⚠️ Do not conflate the DLC's
**"To Dust You Shan't Return"** (not in data) with the base-game Kuttenberg side quest
**"Thou art but dust…"** (Brother Morticius / the Sedletz ossuary) — different quests that
happen to share the monastery setting and a biblical phrase.

## Provenance

Web research run **2026-07-05**. English in-game titles; order per walkthrough
sequence. Some Mysteria Ecclesiae quests are missable depending on dialogue/NPC
choices. Sources:

- PowerPyx walkthroughs — [The Lion's Crest](https://www.powerpyx.com/kingdom-come-deliverance-2-the-lions-crest-walkthrough/), [Brushes with Death](https://www.powerpyx.com/kingdom-come-deliverance-2-brushes-with-death-dlc-walkthrough/), [Legacy of the Forge](https://www.powerpyx.com/kingdom-come-deliverance-2-legacy-of-the-forge-dlc-walkthrough/), [Mysteria Ecclesiae](https://www.powerpyx.com/kingdom-come-deliverance-2-mysteria-ecclesiae-dlc-walkthrough/)
- [gamepressure — Brushes with Death, all quests](https://www.gamepressure.com/kingdom-come-deliverance-2/all-quests/zf119ac)
- [KCD2 Fextralife wiki — DLC hub](https://kingdomcomedeliverance2.wiki.fextralife.com/DLC)
- [game-checklists — Legacy of the Forge checklist](https://game-checklists.com/kcd2/legacy-of-the-forge-checklist/) (full 6 main + 12 task + 9 sketch breakdown; re-verified **2026-07-05**)
