# Language AI policy priorities radar

An interactive version of the blank radar worksheet from Ntampaka et al.,
*How to Craft the Right Language AI Policy For Your Research Group (Some
Assembly Required)*, [arXiv:2607.20836](https://arxiv.org/abs/2607.20836).

Rate the paper's eleven objectives from 1 (low priority) to 5 (highly
prioritised) and see your profile against the four laboratory archetypes. During
a meeting, everyone submits into a shared session and the presenter view shows
the live group mean and the spread around it.

**Setup:** see [SETUP.md](SETUP.md).

## Pages

| Page | For |
|---|---|
| `index.html` | Anyone — rate the objectives, compare with the archetypes, optionally join a session |
| `present.html` | The presenter — big radar, join code, QR, live group mean |

## How sessions work

There are no accounts and no passwords. The presenter generates a short code;
anyone with the code submits into that pool. A random per-browser identifier
means a person who changes their mind updates their own response rather than
being counted twice. Nothing identifying is stored — just eleven numbers.

Codes are a room number, not a secret. Anyone holding one can submit or clear
the votes, which is the right trade for a group meeting.

## Design notes

**Archetypes are grey on purpose.** They are reference context, so hue is
reserved for live data. Four distinct archetype colours cannot clear the
all-pairs colour-blindness separation floors in dark mode — the closest
candidates fail at ΔE 7.1 (red↔orange) and 9.8 (violet↔blue) against a floor of
15 — so identity is carried by the paper's four dash patterns plus direct
labels in the small-multiple panels instead.

**The archetype numbers are estimates.** The paper plots the four profiles in
Figure 1 but does not tabulate them, so the values in `js/data.js` were read off
the figure by eye. They are isolated at the top of that file: correct a number
there and every view updates.

**Spread is shown, not just the mean.** The shaded band is ±1σ across
respondents. Where a group agrees it is thin; where it disagrees it is wide —
and the disagreement is arguably the more interesting output of the exercise.

## Structure

```
index.html          participant page
present.html        presenter view
firebase-config.js  your Firebase keys (public by design)
css/style.css       all styling and colour tokens
js/data.js          axes, archetype profiles, aggregation maths
js/radar.js         SVG radar renderer
js/ui.js            legend, tooltip, sliders, table, small multiples
js/store.js         Firebase read/write, with a local-only fallback
js/app.js           participant page logic
js/present.js       presenter view logic
vendor/qrcode.js    QR generator (MIT, Kazuhiko Arase), vendored so the
                    presenter view does not depend on a CDN at meeting time
```

No build step, no dependencies to install. Plain ES modules.

## Accessibility

Every value on the radar is also in the table view. Series identity never rests
on colour alone — the legend carries dash patterns, the small multiples are
titled. The hover tooltip is reachable by keyboard, and the hit target is the
whole sector rather than the line.
