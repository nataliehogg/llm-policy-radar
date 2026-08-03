# Setup

Two things to do: create a Firebase project (about five minutes, in a browser),
then publish to GitHub Pages.

Without step 1 the site still works — rating the objectives on the radar and
comparing yourself with the archetypes — but votes cannot be shared between
people.

---

## 1. Firebase Realtime Database

### Create the project

1. Go to <https://console.firebase.google.com> and sign in.
2. **Create a project**. Call it whatever you like, e.g. `ai-policy-radar`.
3. Google Analytics is not needed — switch it off.

### Create the database

4. In the left sidebar: **Build → Realtime Database → Create Database**.
   (Realtime Database, *not* Firestore — this site uses the former.)
5. Pick a location. `europe-west1` is the sensible one from the UK.
6. When asked about security rules, choose **Start in locked mode**. The next
   step replaces them anyway, and locked mode avoids the 30-day expiry warning
   that test mode carries.

### Set the security rules

7. Open the **Rules** tab and replace everything with:

```json
{
  "rules": {
    "sessions": {
      "$code": {
        "responses": {
          ".read": true,
          ".write": true,
          "$client": {
            ".validate": "newData.hasChildren(['scores'])",
            "scores": {
              "$axis": {
                ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 5"
              }
            },
            "ts": { ".validate": true }
          }
        }
      }
    }
  }
}
```

8. **Publish**.

What these rules do: anyone can read and write responses inside a session, but
only responses — nothing else in the database is reachable, and a score has to
be a number from 1 to 5, so the shape of the data cannot be corrupted.

What they deliberately do not do: stop someone who has the code from submitting
several times from different browsers, or from clearing the votes. That is the
right trade for a group meeting — the alternative is making everyone sign in.
Codes are not secret; treat them like a room number, not a password.

### Get the config

9. Click the gear icon → **Project settings**.
10. Scroll to **Your apps**, click the web icon (`</>`).
11. Register the app with any nickname. **Do not** tick Firebase Hosting — GitHub
    Pages is doing that job.
12. Copy the `firebaseConfig` object it shows you.
13. Paste **only the values** into `firebase-config.js`, keeping the existing
    `export const firebaseConfig = { … }` wrapper.

> **Ignore the rest of the console's snippet.** It shows
> `npm install firebase` and
> `import { initializeApp } from "firebase/app"`, which is advice for apps built
> with a bundler. This site is plain ES modules with no build step: `js/store.js`
> loads the SDK from Google's CDN and calls `initializeApp` itself. Running
> `npm install firebase` here just drops ~180 MB of `node_modules` into the repo
> for nothing — `.gitignore` now excludes it.
>
> The config file needs to *export* the object. A bare `const firebaseConfig`
> will not import, and the site will silently fall back to local-only mode.

`databaseURL` must be present. If it is missing from the snippet, go back to
Realtime Database and copy the URL from the top of the Data tab — it looks like
`https://your-project-default-rtdb.europe-west1.firebasedatabase.app`.

> These keys are **not secrets**. Firebase web config is public by design; the
> security rules above are what actually control access. Committing this file is
> expected.

---

## 2. GitHub Pages

Already done. The repo is
[nataliehogg/llm-policy-radar](https://github.com/nataliehogg/llm-policy-radar)
and Pages is serving `main` from the repository root:

**<https://nataliehogg.github.io/llm-policy-radar/>**

Pushing to `main` redeploys it, usually within a minute:

```bash
git add -A && git commit -m "..." && git push
```

If you ever need to re-enable Pages: **Settings → Pages → Source: Deploy from a
branch → main / (root)**.

---

## 3. Check it works

1. Open `present.html` — a code is generated automatically.
2. Open `index.html?session=<that code>` in a second browser (or on your phone),
   drag some points, submit.
3. The presenter view should update within a second, without a refresh.

---

## Running it before the meeting

- **Rehearse the presenter view** with fabricated data:
  `present.html?demo=9` — nine random responses, generated locally, never
  written to the database.
- **Force a theme** for the projector: add `?theme=light` or `?theme=dark` to
  either page.
- **Pre-select archetype overlays**:
  `present.html?archetypes=trustworthiness,high_leverage`
- **Test locally** without deploying:
  `python3 -m http.server 8777` then open <http://127.0.0.1:8777/>.
  It must be served over HTTP — opening the file directly with `file://` breaks
  ES module imports.

## On the day

1. Open `present.html`, hit **New code**, screenshare it.
2. People scan the QR or type the short URL and the code.
3. Watch the mean and the ±1σ band fill in as responses arrive.
4. **Clear votes** if you want to re-run the exercise after discussion — the
   code stays the same, so nobody has to rejoin.

## Afterwards

Votes are not deleted when the meeting ends; they stay under
`sessions/<CODE>/responses` until you press **Clear votes**. Reopen
`present.html?session=<CODE>` whenever you like.

Before clearing anything, use **Download CSV** or **Download JSON** on the
presenter view to keep a copy — clearing cannot be undone. The presenter view
also lists codes you have previously presented from that browser.

Tell people they can press **Leave session** when the meeting is over. It keeps
their vote in the group average but detaches their browser, so playing with the
radar later cannot change the result. **Remove my response** is there for
anyone who wants their vote taken out altogether.
