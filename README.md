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

**Nothing is submitted implicitly.** Dragging points only ever changes your
own radar; the group average changes when you press the button and at no other
time.

**Leaving.** *Leave session* detaches this browser — it forgets the code, drops
it from the URL, and stops the live updates, so later fiddling with the radar
cannot reach the group. Your already-submitted response stays in the average,
which is usually what you want: you did vote in the meeting. If you want out
entirely, *Remove my response* deletes it and the average is recalculated
without you.

## Keeping the results

Votes persist in the database indefinitely. There is no expiry — the only thing
that deletes them is the presenter's **Clear votes** button. Reopening
`present.html?session=CODE` brings a past session straight back.

The presenter view can download a session as **CSV** (one row per respondent,
one column per objective, with mean and standard deviation as trailing rows) or
as **JSON** (the same data plus the axis metadata and summary statistics). Worth
doing before clearing a session, since clearing is irreversible.

The security rules block listing the `/sessions` root, so the app cannot
enumerate past sessions. Instead the presenter view keeps a local list of the
codes *this browser* has presented, shown under "Earlier sessions". If you lose
a code and clear that browser's storage, the Firebase console's Data tab is the
remaining way to find it.

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
js/ui.js            legend, tooltip, value readout, table, small multiples
js/store.js         Firebase read/write, with a local-only fallback
js/app.js           participant page logic
js/present.js       presenter view logic
vendor/qrcode.js    QR generator (MIT, Kazuhiko Arase), vendored so the
                    presenter view does not depend on a CDN at meeting time
```

No build step, no dependencies to install. Plain ES modules.

## Rating by direct manipulation

The radar *is* the input — drag a point in or out and it snaps to the nearest
whole rating. The whole sector is draggable, not just the dot, so it is
forgiving to hit; presses out among the labels are ignored.

Every axis is also a real ARIA slider: <kbd>Tab</kbd> to one and use the arrow
keys, <kbd>Home</kbd>/<kbd>End</kbd> for the extremes, or type <kbd>1</kbd>–<kbd>5</kbd>
to jump. Screen readers announce the current value, which is kept in step with
what is drawn. Dragging alone would have shut out keyboard users, so the two
paths are equivalent rather than the keyboard being an afterthought.

## Accessibility

Series identity never rests on colour alone — the legend carries dash patterns
and the small multiples are titled. The "Your ratings" panel lists every
objective and its current value in text, so nothing on the participant page is
only reachable by reading the chart. The presenter view keeps a table view for
the same reason, since it has no such panel. The hover tooltip is reachable by
keyboard, and the hit target is the whole sector rather than the line.
