// Participant page: rate the eleven objectives, compare with the archetypes,
// and optionally submit into a shared session.

import { AXES, ARCHETYPES, ARCHETYPE_BY_ID, defaultScores, aggregate } from './data.js';
import { Radar } from './radar.js';
import {
  renderLegend,
  renderReadout,
  syncReadout,
  renderMultiples,
  Tooltip,
  axisTooltipHtml,
} from './ui.js';
import * as store from './store.js';

const state = {
  scores: store.loadLocalScores() || defaultScores(),
  activeArchetypes: new Set(),
  agg: null,
  session: '',
  submitted: false,
  unsub: null,
};

// Guard against a stale localStorage payload from an earlier axis list.
for (const axis of AXES) {
  if (!Number.isFinite(state.scores[axis.id])) state.scores[axis.id] = 3;
}

const tooltip = new Tooltip(document.getElementById('tooltip'));
let radar;

/* ------------------------------------------------------------------ chart */

function seriesForMain() {
  const series = [];
  for (const id of state.activeArchetypes) {
    const a = ARCHETYPE_BY_ID[id];
    series.push({
      id: a.id,
      className: 's-archetype',
      scores: a.scores,
      dash: a.dash,
      fill: false,
    });
  }
  if (state.agg && state.agg.n) {
    const band = {};
    const means = {};
    for (const axis of AXES) {
      const s = state.agg.stats[axis.id];
      means[axis.id] = s.mean ?? 1;
      band[axis.id] = [
        Math.max(1, (s.mean ?? 1) - s.sd),
        Math.min(5, (s.mean ?? 1) + s.sd),
      ];
    }
    series.push({ id: 'mean', className: 's-mean', scores: means, band, markers: true });
  }
  series.push({ id: 'you', className: 's-you', scores: state.scores, markers: true });
  return series;
}

function legendEntries() {
  const entries = [];
  entries.push({ label: 'You', className: 's-you' });
  if (state.agg && state.agg.n) {
    entries.push({ label: `Group mean (n=${state.agg.n}, shaded ±1σ)`, className: 's-mean' });
  }
  for (const id of state.activeArchetypes) {
    const a = ARCHETYPE_BY_ID[id];
    entries.push({ label: a.label, className: 's-archetype', dash: a.dash });
  }
  return entries;
}

function draw() {
  radar.setSeries(seriesForMain());
  radar.syncAria(state.scores);
  syncReadout(state.scores);
  renderLegend(document.getElementById('legend'), legendEntries());
  renderMultiples(document.getElementById('multiples'), state.scores);
}

/* ---------------------------------------------------------------- session */

function setStatus(msg, live = false) {
  const node = document.getElementById('session-status');
  node.innerHTML = live ? `<span class="dot-live"></span>${msg}` : msg;
}

function updateSessionActions() {
  const actions = document.getElementById('session-actions');
  if (!actions) return;
  actions.hidden = !state.session;
  document.getElementById('withdraw-btn').hidden = !state.submitted;
}

/**
 * Detach from the session without touching the submitted response: someone who
 * voted in the meeting stays in that meeting's average. Their radar keeps
 * working locally, and nothing they do afterwards reaches the group.
 */
function leaveSession() {
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  const left = state.session;
  state.session = '';
  state.agg = null;
  state.submitted = false;
  store.forgetSession();
  document.getElementById('session-code').value = '';
  document.getElementById('submit-btn').textContent = 'Submit my scores';
  // Drop the code from the URL too, or a refresh silently rejoins.
  const url = new URL(location.href);
  url.searchParams.delete('session');
  url.searchParams.delete('s');
  history.replaceState(null, '', url);
  setStatus(
    left
      ? `Left <strong>${left}</strong>. Your scores are yours alone now — change them freely, ` +
          'nothing is sent to the group unless you rejoin and submit.'
      : 'Not in a session.'
  );
  updateSessionActions();
  draw();
}

async function withdraw() {
  const code = state.session;
  if (!code) return;
  if (!confirm(`Remove your response from session ${code}? The group average will be recalculated without it.`)) {
    return;
  }
  const btn = document.getElementById('withdraw-btn');
  btn.disabled = true;
  try {
    await store.withdrawResponse(code);
    state.submitted = false;
    setStatus(`Your response has been removed from <strong>${code}</strong>.`);
    updateSessionActions();
  } catch (err) {
    setStatus(`Could not remove: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function joinSession(code) {
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  state.session = code;
  state.agg = null;
  if (!code) {
    updateSessionActions();
    draw();
    return;
  }
  store.rememberSession(code);
  try {
    state.unsub = await store.watchSession(
      code,
      (responses) => {
        state.agg = aggregate(responses);
        const mine = responses.some((r) => r.id === store.getClientId());
        state.submitted = mine;
        document.getElementById('submit-btn').textContent = mine
          ? 'Update my scores'
          : 'Submit my scores';
        setStatus(
          `Live in <strong>${code}</strong> — ${state.agg ? state.agg.n : 0} response${
            state.agg && state.agg.n === 1 ? '' : 's'
          }${mine ? ', including yours' : ''}.`,
          true
        );
        updateSessionActions();
        draw();
      },
      (err) => setStatus(`Could not read session: ${err.message}`)
    );
  } catch (err) {
    setStatus(`Could not join: ${err.message}`);
  }
}

async function submit() {
  const code = store.normaliseCode(document.getElementById('session-code').value);
  if (!code) {
    setStatus('Enter the session code first.');
    return;
  }
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  try {
    await store.submitResponse(code, state.scores);
    if (state.session !== code) await joinSession(code);
    setStatus('Submitted. Move a point and submit again to update your answer.', true);
  } catch (err) {
    setStatus(`Could not submit: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------- init */

function init() {
  radar = new Radar(document.getElementById('radar'), {
    size: 560,
    editScores: () => state.scores,
    onEdit: (axisIndex, value) => {
      const axisId = AXES[axisIndex].id;
      if (state.scores[axisId] === value) return;
      state.scores[axisId] = value;
      store.saveLocalScores(state.scores);
      draw();
    },
    onHover: (index, ev) => {
      radar.setActiveAxis(index);
      if (index === null) {
        tooltip.hide();
        return;
      }
      tooltip.show(
        axisTooltipHtml(index, {
          agg: state.agg,
          yours: state.scores,
          activeArchetypes: [...state.activeArchetypes].map((id) => ARCHETYPE_BY_ID[id]),
        }),
        ev
      );
    },
  });

  // Optional panels. Anything below here must tolerate its element being absent,
  // or removing one card from the HTML silently kills every feature wired after
  // it — which is exactly what a missing #readout used to do.
  const readout = document.getElementById('readout');
  if (readout) {
    renderReadout(readout, state.scores, (index) => radar.setActiveAxis(index));
  }

  // Archetype toggles. Absent on the participant page, where the four
  // small-multiple panels already show every archetype.
  const chips = document.getElementById('archetype-chips');
  for (const a of chips ? ARCHETYPES : []) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = a.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.title = `${a.optimises} — ${a.question}`;
    btn.addEventListener('click', () => {
      if (state.activeArchetypes.has(a.id)) state.activeArchetypes.delete(a.id);
      else state.activeArchetypes.add(a.id);
      btn.setAttribute('aria-pressed', String(state.activeArchetypes.has(a.id)));
      draw();
    });
    li.appendChild(btn);
    chips.appendChild(li);
  }

  document.getElementById('copy-btn')?.addEventListener('click', async (ev) => {
    const text = AXES.map((a) => `${a.label}\t${state.scores[a.id]}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      ev.target.textContent = 'Copied';
      setTimeout(() => (ev.target.textContent = 'Copy scores'), 1500);
    } catch {
      ev.target.textContent = 'Copy failed';
      setTimeout(() => (ev.target.textContent = 'Copy scores'), 1500);
    }
  });

  // Session wiring.
  const codeInput = document.getElementById('session-code');
  const params = new URLSearchParams(location.search);
  const fromUrl = store.normaliseCode(params.get('session') || params.get('s') || '');
  const initialCode = fromUrl || store.normaliseCode(store.lastSession());

  if (!store.isConfigured) {
    document.getElementById('config-banner').hidden = false;
    document.getElementById('session-card').hidden = true;
  } else {
    codeInput.value = initialCode;
    document.getElementById('submit-btn').addEventListener('click', submit);
    document.getElementById('leave-btn').addEventListener('click', leaveSession);
    document.getElementById('withdraw-btn').addEventListener('click', withdraw);
    codeInput.addEventListener('change', () => {
      const code = store.normaliseCode(codeInput.value);
      codeInput.value = code;
      joinSession(code);
    });
    codeInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') submit();
    });
    document.getElementById('session-extra').textContent =
      'Anonymous. Nothing is sent until you press submit; resubmitting replaces your answer.';
    if (initialCode) joinSession(initialCode);
    else setStatus('Not in a session yet.');
    updateSessionActions();
  }

  draw();
}

init();
