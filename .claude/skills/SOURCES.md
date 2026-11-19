# Herkunft der Skills in diesem Repo

## Eingecheckte Kopien (fest auf einen geprüften Stand)

| Skill | Quelle | Commit | Lizenz |
|---|---|---|---|
| `security-audit` | <https://github.com/cloudflare/security-audit-skill> | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | MIT |
| `reverse-engineer-anything` | <https://github.com/Speedrunlab/reverse-engineer-anything> | `315d033c94acb08cf2155a7cf08144c138f15136` | MIT |
| `grill-me`, `grill-with-docs`, `grilling`, `domain-modeling` | <https://github.com/mattpocock/skills> | `5863806dd4e15c63174bee4e7515a4256792ecfa` | MIT |
| `find-skills` | <https://github.com/vercel-labs/skills> | `57217cf86ba38148a57af9e90d14a4c049558330` | siehe Quelle |

`grill-me` und `grill-with-docs` rufen nur `grilling` bzw. `domain-modeling` auf, deshalb sind
alle vier eingecheckt. `find-skills` schlägt Skills aus dem Internet vor und installiert sie per
`npx skills add` – jede so vorgeschlagene Quelle vor der Installation prüfen.

Ohne Testdateien übernommen. Für ein Update den Ordner aus der Quelle neu kopieren und den Commit hier nachtragen.

## Als Plugin eingebunden (`.claude/settings.json`)

| Plugin | Quelle | Geprüfter Stand |
|---|---|---|
| `founder-skill` | <https://github.com/Jakeschincariol/founder-skill> | `fd9385b0cfe1b96bebce3898fbd506d73eff5a9d` |
| `marketing-skills` | <https://github.com/coreyhaines31/marketingskills> | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` |
| `hallmark` | <https://github.com/Nutlope/hallmark> | `04977e15f3dfd6ee4b74c887dac3eb52665d6c92` |

Diese Plugins folgen dem jeweils aktuellen Stand der Quelle und sind nicht auf einen Commit
festgelegt. Die Prüfung gilt nur für den genannten Stand.
