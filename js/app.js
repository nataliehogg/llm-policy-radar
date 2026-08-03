// Participant page: rate the eleven objectives, compare with the archetypes,
// and optionally submit into a shared session.

import { AXES, ARCHETYPES, ARCHETYPE_BY_ID, defaultScores, aggregate } from './data.js';
import { Radar } from './radar.js';
import {
  initTheme,
  renderLegend,
  renderSliders,
  syncSliders,
  renderMultiples,
  renderTable,
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
  renderLegend(document.getElementById('legend'), legendEntries());
  renderMultiples(document.getElementById('multiples'), state.scores);
  renderTable(document.getElementById('table-view'), {
    agg: state.agg,
    yours: state.scores,
    archetypes: ARCHETYPES,
  });
}

/* ---------------------------------------------------------------- session */

function setStatus(msg, live = false) {
  const node = document.getElementById('session-status');
  node.innerHTML = live ? `<span class="dot-live"></span>${msg}` : msg;
}

async function joinSession(code) {
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  state.session = code;
  state.agg = null;
  if (!code) {
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
    setStatus('Submitted. Change a slider and submit again to update your answer.', true);
  } catch (err) {
    setStatus(`Could not submit: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------- init */

function init() {
  initTheme();

  radar = new Radar(document.getElementById('radar'), {
    size: 560,
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

  renderSliders(document.getElementById('sliders'), state.scores, (axisId, value) => {
    state.scores[axisId] = value;
    store.saveLocalScores(state.scores);
    draw();
  });

  // Archetype toggles.
  const chips = document.getElementById('archetype-chips');
  for (const a of ARCHETYPES) {
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

  document.getElementById('reset-btn').addEventListener('click', () => {
    state.scores = defaultScores();
    store.saveLocalScores(state.scores);
    syncSliders(state.scores);
    draw();
  });

  document.getElementById('copy-btn').addEventListener('click', async (ev) => {
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
    codeInput.addEventListener('change', () => {
      const code = store.normaliseCode(codeInput.value);
      codeInput.value = code;
      joinSession(code);
    });
    codeInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') submit();
    });
    document.getElementById('session-extra').textContent =
      'Anonymous. You can change your answer at any time — resubmitting replaces your previous one.';
    if (initialCode) joinSession(initialCode);
    else setStatus('Not in a session yet.');
  }

  draw();
}

init();
