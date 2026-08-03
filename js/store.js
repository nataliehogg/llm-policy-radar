// Vote storage.
//
// Two modes, chosen automatically:
//   - Firebase Realtime Database, when firebase-config.js has been filled in.
//     Votes push to every open presenter view instantly.
//   - Local only, when it has not. Everything on the page still works; sessions
//     just cannot be shared. This keeps the site usable if the backend is
//     misconfigured or unreachable, rather than showing a dead page.

import { firebaseConfig } from '../firebase-config.js';

const LS_CLIENT_ID = 'radar.clientId';
const LS_SCORES = 'radar.scores';
const LS_LAST_SESSION = 'radar.lastSession';
const LS_PRESENTED = 'radar.presentedSessions';

export const isConfigured = Boolean(
  firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL
);

let dbPromise = null;

async function getDb() {
  if (!isConfigured) throw new Error('Firebase is not configured');
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ initializeApp }, dbMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'),
      ]);
      const app = initializeApp(firebaseConfig);
      return { db: dbMod.getDatabase(app), ...dbMod };
    })();
  }
  return dbPromise;
}

/**
 * A stable per-browser id, so a person who changes their mind updates their own
 * response rather than being counted twice.
 */
export function getClientId() {
  let id = localStorage.getItem(LS_CLIENT_ID);
  if (!id) {
    id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem(LS_CLIENT_ID, id);
  }
  return id;
}

/** Firebase keys cannot contain . # $ [ ] / — and codes should be easy to read aloud. */
export function normaliseCode(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
}

/** Ambiguous characters (0/O, 1/I) are excluded so codes survive being read out. */
export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function saveLocalScores(scores) {
  try {
    localStorage.setItem(LS_SCORES, JSON.stringify(scores));
  } catch {
    /* private browsing — not worth surfacing */
  }
}

export function loadLocalScores() {
  try {
    const raw = localStorage.getItem(LS_SCORES);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function rememberSession(code) {
  try {
    localStorage.setItem(LS_LAST_SESSION, code);
  } catch {
    /* ignore */
  }
}

export function lastSession() {
  try {
    return localStorage.getItem(LS_LAST_SESSION) || '';
  } catch {
    return '';
  }
}

/**
 * Stop this browser rejoining a session on the next visit. Deliberately does not
 * touch the stored response — someone who voted in a meeting should stay in that
 * meeting's average even after they leave the page.
 */
export function forgetSession() {
  try {
    localStorage.removeItem(LS_LAST_SESSION);
  } catch {
    /* ignore */
  }
}

/**
 * Codes this browser has presented. The security rules block listing the
 * /sessions root — by design — so the presenter needs a local record to find
 * past sessions again.
 */
export function recentSessions() {
  try {
    const raw = localStorage.getItem(LS_PRESENTED);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberPresented(code) {
  try {
    const list = recentSessions().filter((s) => s.code !== code);
    list.unshift({ code, at: Date.now() });
    localStorage.setItem(LS_PRESENTED, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* ignore */
  }
}

/** Write (or overwrite) this browser's response for a session. */
export async function submitResponse(code, scores) {
  const { db, ref, set, serverTimestamp } = await getDb();
  const clientId = getClientId();
  await set(ref(db, `sessions/${code}/responses/${clientId}`), {
    scores,
    ts: serverTimestamp(),
  });
}

/** Remove this browser's response from a session. */
export async function withdrawResponse(code) {
  const { db, ref, remove } = await getDb();
  await remove(ref(db, `sessions/${code}/responses/${getClientId()}`));
}

/**
 * Subscribe to a session's responses.
 * @returns {Promise<function>} an unsubscribe function
 */
export async function watchSession(code, onData, onError) {
  const { db, ref, onValue } = await getDb();
  const node = ref(db, `sessions/${code}/responses`);
  const unsub = onValue(
    node,
    (snap) => {
      const val = snap.val() || {};
      const responses = Object.entries(val).map(([id, r]) => ({ id, ...r }));
      onData(responses);
    },
    (err) => onError && onError(err)
  );
  return unsub;
}

/**
 * Wipe a session's responses so the exercise can be re-run after discussion.
 * Targets the `responses` node rather than the session itself, so the security
 * rules only ever need to grant write access one level down.
 */
export async function clearSession(code) {
  const { db, ref, remove } = await getDb();
  await remove(ref(db, `sessions/${code}/responses`));
}
