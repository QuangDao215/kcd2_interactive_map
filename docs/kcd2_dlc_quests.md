# KCD2 DLC quests — name reference

Quest-name reference for the KCD2 story-expansion DLCs, to populate the DLC quest
marker classes (`quest_dlc0`–`quest_dlc3`, in the **Quests** group). The extracted
marker data (`data/markers_trosky.json`, `data/markers_kuttenberg.json`) contains
**no** DLC entries (0 references), so these names come from the wiki/walkthroughs,
not the game files this repo extracts.

## Icon → DLC mapping (verify in-game before baking markers)

The four crests are the game's internal `DLC0`–`DLC3` index, but there are only
**three** story-expansion DLCs. Best-guess mapping:

| Icon | Crest | Likely DLC | Confidence |
|---|---|---|---|
| `DLC3_icon` | green shield, cross | **Mysteria Ecclesiae** (monastery/church) | high — crest theme matches |
| `DLC1_icon` / `DLC2_icon` | purple crests | **Brushes with Death** / **Legacy of the Forge** | order unconfirmed |
| `DLC0_icon` | purple, white lion | a cosmetic / pre-order / free-content pack | likely **no story quest line** |

Confirm which crest belongs to which DLC in-game before attaching quest markers.

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

## Legacy of the Forge — 7 main quests + guild activities
Ruined **forge in Kuttenberg** / the Blacksmiths' Guild (available after Main Quest 14).

**Main questline**
1. Adept
2. Magdalena's Axe
3. The Master's Game
4. Klaus' Introduction
5. Martin's Dream
6. Old Plans
7. The Last Step

**Guild activities (repeatable tasks)**
- In the Service of the Guild: Warlock's Riddle Investigation
- In the Service of the Guild: Silent Partner Investigation
- Sinners of Kuttenberg: Ragman's Dream Thieving Contract
- Kuttenberg Sharpshooters: Two Brothers Archery Contest

## Mysteria Ecclesiae — 11 (6 side quests + 5 tasks)
Escort the royal physician to **Sedletz Monastery** east of Kuttenberg.

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

## Provenance

Web research run **2026-07-05**. English in-game titles; order per walkthrough
sequence. Some Mysteria Ecclesiae quests are missable depending on dialogue/NPC
choices. Sources:

- PowerPyx walkthroughs — [Brushes with Death](https://www.powerpyx.com/kingdom-come-deliverance-2-brushes-with-death-dlc-walkthrough/), [Legacy of the Forge](https://www.powerpyx.com/kingdom-come-deliverance-2-legacy-of-the-forge-dlc-walkthrough/), [Mysteria Ecclesiae](https://www.powerpyx.com/kingdom-come-deliverance-2-mysteria-ecclesiae-dlc-walkthrough/)
- [gamepressure — Brushes with Death, all quests](https://www.gamepressure.com/kingdom-come-deliverance-2/all-quests/zf119ac)
- [KCD2 Fextralife wiki — DLC hub](https://kingdomcomedeliverance2.wiki.fextralife.com/DLC)
