# KCD2 Taverns, Inns & Lodgings — verified name reference

Reference table of every confirmed tavern / inn / lodging in **Kingdom Come: Deliverance II**
(Warhorse, 2025), mapping the **extracted game-file names** (Czech) to their **in-game English
names**, settlement, and innkeeper. Use this when naming/renaming POI markers so the map matches
the in-game signage.

> **Provenance:** deep-research pass (fan-out web search → fetch → adversarial verify → synthesis,
> ~100 agents) run **2026-06-24**, cross-referenced against this repo's extracted files
> (`data/markers_trosky.json`, `data/markers_kuttenberg.json`). Sources: KCD2 Fandom wiki,
> Fextralife, INARA (`inara.cz/kingdom-come-2`), Gamer Guides, PowerPyx. The four big databases
> 403/503-block direct fetch, so most verification used search-snippet quotes + the extracted
> files (adequate for mundane current-game facts, **not** primary-source-grade).

## Naming convention (from the in-game Codex "Taverns, Inns and Innkeepers")

- **`Hospoda …`** → a **pub / tavern** ("hospoda" likely from Old Slavonic *gospod/gospodja*, "Master of the House").
- **`Zajezdni Hostinec …`** (Czech *Zájezdní hostinec*) → a **Wagoners' Inn**: an out-of-town inn at a
  crossroads/trade route with overnight rooms, **stables**, and carriage space (a *wagoner* = cart driver).
- The Codex entry itself is descriptive lore only — it names **no** specific establishment.

## Trosky region

| In-game English name | Settlement / location | Innkeeper(s) | Extracted file name | Conf. |
|---|---|---|---|---|
| **Zhelejov Wagoners' Inn** | Sits apart NW/W of Zhelejov (own fast-travel point), reached via the road west from Troskowitz | Lawrence (Czech *Vavřinec*) & wife Marie | `Zajezdni Hostinec Zelejov` | High |
| **Tachov Inn** | Tachov village | Prochek & wife Voyka (run a fight club; quest *Battle of the Frogs and Mice*) | — | High |

## Kuttenberg region

| In-game English name | Settlement / location | Innkeeper(s) | Extracted file name | Conf. |
|---|---|---|---|---|
| **Pschitoky Wagoners' Inn** | South of Pschitoky, near the Miskowitz–Kuttenberg crossroads; adjacent bathhouse `Lazne Pritoky` | **Wolfram Raus** | `Zajezdni Hostinec Pritoky` | High |
| **The Hole in the Wall** (keeps the article "The") | Kuttenberg city — Hoprink district (poorer unwalled suburb, E/SE of the inner walls) | Mole | likely **`Pub Dira`** (Czech *Díra* = "Hole") | High |
| **Iron Eagle Tavern** (German *Schenke zum Eisernen Adler*) | Kuttenberg city — Armourers' Street, off the pig market | Franz Geldstück (ASCII *Geldstuck*) | — (a "…Eagle Pub" file name) | High |
| **Black Horse Pub** | Kuttenberg city — inn of the *Striped Tonies* miners | Weighman (sells dice) | `Black Horse Pub` | Medium |
| **King Solomon Tavern** | Kuttenberg city — north / Jewish Quarter | owner **unconfirmed** | — | Medium |

## Open items — extracted file names not yet mapped to an English name

- **`Hospoda Konsky Trh`** — lit. "Horse Market Pub"; likely a Kuttenberg-city pub by the horse market.
  (Don't confuse with the *smithy* `Kovar Konsky Trh` = "Horse-Market Smith".)
- **`Emperor Charles Pub`** — unmapped.
- **`Pub Dira`** — Czech *Díra* = "Hole"; very likely just the Czech file name for **The Hole in the Wall** (would deduplicate).
- **`All Saints Pub`** — the rival miners' tavern to the Black Horse / Striped Tonies.
- **`Stall With Beverage`** — a beverage stall.

## Caveats

- **`Black Horse Pub` vs "Black Horse Tavern":** the wiki labels it "Tavern", but the extracted file says
  **Pub** and the literal "Black Horse Tavern" string was explicitly **refuted (0–3)**. Prefer "Pub".
- **Apostrophe variant (Zhelejov):** game files / Gamer Guides use singular *Wagoner's*; INARA / Fandom use
  plural *Wagoners'*. This repo's markers use plural *Wagoners'* (match existing data for consistency).
- **King Solomon Tavern owner:** the name "Samuel" was **refuted (1–2)** — treat the owner as unconfirmed.
- **Innkeeper display names** often embed the occupation title (e.g. "Innkeeper Weighman", where *Weighman*
  is an ore-weigher occupation, not a surname).
- This list is **not confirmed complete** — see open items above.
