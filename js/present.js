// Presenter view: big radar of the live group mean, plus the join code and QR
// for the room. Designed to be screenshared as-is.

import { AXES, ARCHETYPES, ARCHETYPE_BY_ID, aggregate, meanScores } from './data.js';
import { Radar } from './radar.js';
import {
  initTheme,
  renderLegend,
  renderMultiples,
  renderRanks,
  renderTable,
  Tooltip,
  axisTooltipHtml,
} from './ui.js';
import * as store from './store.js';

const state = {
  code: '',
  agg: null,
  activeArchetypes: new Set(),
  unsub: null,
};

const tooltip = new Tooltip(document.getElementById('tooltip'));
let radar;

/* --------------------------------------------------------------- join URL */

function voteUrl(code) {
  const url = new URL('index.html', location.href);
  url.search = `?session=${encodeURIComponent(code)}`;
  return url.toString();
}

/** Shown to the room — strip the scheme so it is shorter to read out. */
function prettyUrl(code) {
  return voteUrl(code).replace(/^https?:\/\//, '');
}

function renderQr(code) {
  const img = document.getElementById('qr');
  if (typeof qrcode !== 'function') {
    img.hidden = true;
    return;
  }
  try {
    // Type 0 auto-sizes to the data; 'M' tolerates a projector's glare.
    const qr = qrcode(0, 'M');
    qr.addData(voteUrl(code));
    qr.make();
    img.src = qr.createDataURL(8, 8);
    img.hidden = false;
  } catch {
    img.hidden = true;
  }
}

function setCode(code) {
  state.code = code;
  document.getElementById('join-code').textContent = code || '—';
  document.getElementById('join-url').textContent = code ? prettyUrl(code) : '—';
  if (code) renderQr(code);
  // Keep the code in the URL so a refresh — or a second screen — lands in the
  // same session rather than minting a new one.
  const url = new URL(location.href);
  url.searchParams.set('session', code);
  history.replaceState(null, '', url);
}

/* ------------------------------------------------------------------ chart */

function seriesForMain() {
  const series = [];
  for (const id of state.activeArchetypes) {
    const a = ARCHETYPE_BY_ID[id];
    series.push({ id: a.id, className: 's-archetype', scores: a.scores, dash: a.dash, fill: false });
  }
  if (state.agg && state.agg.n) {
    const band = {};
    const means = {};
    for (const axis of AXES) {
      const s = state.agg.stats[axis.id];
      means[axis.id] = s.mean ?? 1;
      band[axis.id] = [Math.max(1, (s.mean ?? 1) - s.sd), Math.min(5, (s.mean ?? 1) + s.sd)];
    }
    series.push({ id: 'mean', className: 's-mean', scores: means, band, markers: true });
  }
  return series;
}

function legendEntries() {
  const entries = [];
  if (state.agg && state.agg.n) {
    entries.push({ label: `Group mean (n=${state.agg.n}, shaded ±1σ)`, className: 's-mean' });
  }
  for (const id of state.activeArchetypes) {
    const a = ARCHETYPE_BY_ID[id];
    entries.push({ label: a.label, className: 's-archetype', dash: a.dash });
  }
  return entries;
}

function renderDisagreement() {
  const list = document.getElementById('disagreement');
  if (!state.agg || !state.agg.n) {
    list.innerHTML = '<li class="muted">Waiting for responses.</li>';
    return;
  }
  const ranked = AXES.map((axis) => ({ axis, sd: state.agg.stats[axis.id].sd }))
    .sort((a, b) => b.sd - a.sd)
    .slice(0, 3);
  list.innerHTML = ranked
    .map(
      ({ axis, sd }) =>
        `<li><strong>${axis.label}</strong> <span class="muted">σ = ${sd.toFixed(2)}</span></li>`
    )
    .join('');
}

function draw() {
  radar.setSeries(seriesForMain());
  renderLegend(document.getElementById('legend'), legendEntries());

  const means = state.agg && state.agg.n ? meanScores(state.agg) : null;
  renderMultiples(document.getElementById('multiples'), means, { className: 's-mean' });
  renderRanks(document.getElementById('ranks'), means);
  document.getElementById('ranks-empty').hidden = Boolean(means);
  renderTable(document.getElementById('table-view'), {
    agg: state.agg,
    yours: null,
    archetypes: ARCHETYPES,
  });
  renderDisagreement();

  document.getElementById('stat-n').textContent = state.agg ? state.agg.n : 0;
  if (state.agg && state.agg.n > 1) {
    const meanSd =
      AXES.reduce((sum, a) => sum + state.agg.stats[a.id].sd, 0) / AXES.length;
    document.getElementById('stat-spread').textContent = meanSd.toFixed(2);
  } else {
    document.getElementById('stat-spread').textContent = '—';
  }
}

/* ---------------------------------------------------------------- session */

function setStatus(msg, live = false) {
  document.getElementById('status').innerHTML = live
    ? `<span class="dot-live"></span>${msg}`
    : msg;
}

async function watch(code) {
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  if (!store.isConfigured || !code) return;
  try {
    state.unsub = await store.watchSession(
      code,
      (responses) => {
        state.agg = aggregate(responses);
        setStatus('Live — updates as people submit.', true);
        draw();
      },
      (err) => setStatus(`Connection problem: ${err.message}`)
    );
  } catch (err) {
    setStatus(`Could not connect: ${err.message}`);
  }
}

/* ------------------------------------------------------------------- init */

function init() {
  initTheme();

  radar = new Radar(document.getElementById('radar'), {
    size: 620,
    labelChars: 13,
    onHover: (index, ev) => {
      radar.setActiveAxis(index);
      if (index === null) {
        tooltip.hide();
        return;
      }
      tooltip.show(
        axisTooltipHtml(index, {
          agg: state.agg,
          yours: null,
          activeArchetypes: [...state.activeArchetypes].map((id) => ARCHETYPE_BY_ID[id]),
        }),
        ev
      );
    },
  });

  // ?archetypes=trustworthiness,craftsmanship pre-selects overlays, so a
  // particular comparison can be bookmarked or put straight into slides.
  const preset = new URLSearchParams(location.search).get('archetypes');
  if (preset) {
    for (const id of preset.split(',').map((s) => s.trim())) {
      if (ARCHETYPE_BY_ID[id]) state.activeArchetypes.add(id);
    }
  }

  const chips = document.getElementById('archetype-chips');
  for (const a of ARCHETYPES) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = a.label;
    btn.setAttribute('aria-pressed', String(state.activeArchetypes.has(a.id)));
    btn.addEventListener('click', () => {
      if (state.activeArchetypes.has(a.id)) state.activeArchetypes.delete(a.id);
      else state.activeArchetypes.add(a.id);
      btn.setAttribute('aria-pressed', String(state.activeArchetypes.has(a.id)));
      draw();
    });
    li.appendChild(btn);
    chips.appendChild(li);
  }

  document.getElementById('new-session').addEventListener('click', () => {
    const code = store.randomCode();
    state.agg = null;
    setCode(code);
    draw();
    watch(code);
  });

  document.getElementById('reset-session').addEventListener('click', async () => {
    if (!state.code) return;
    const n = state.agg ? state.agg.n : 0;
    if (!confirm(`Delete all ${n} response(s) in session ${state.code}? This cannot be undone.`)) {
      return;
    }
    try {
      await store.clearSession(state.code);
      setStatus('Votes cleared — the same code is still open.', true);
    } catch (err) {
      setStatus(`Could not clear: ${err.message}`);
    }
  });

  if (!store.isConfigured) {
    document.getElementById('config-banner').hidden = false;
    setStatus('No backend configured.');
  }

  const params = new URLSearchParams(location.search);

  // Rehearsal mode: ?demo=8 fabricates eight plausible responses locally so the
  // presenter view can be checked before the meeting. Never touches the backend.
  const demo = Number(params.get('demo'));
  if (Number.isFinite(demo) && demo > 0) {
    state.agg = aggregate(fakeResponses(Math.min(demo, 40)));
    setCode(store.normaliseCode(params.get('session') || '') || 'DEMO');
    setStatus('Rehearsal mode — these responses are fabricated locally.');
    draw();
    return;
  }

  const code = store.normaliseCode(params.get('session') || '') || store.randomCode();
  setCode(code);
  draw();
  watch(code);
}

/**
 * Plausible fake responses for rehearsal: draw a random archetype per person and
 * jitter it, so the mean lands somewhere interesting and the spread is non-zero.
 */
function fakeResponses(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    const scores = {};
    for (const axis of AXES) {
      const jitter = Math.round((Math.random() - 0.5) * 2.6);
      scores[axis.id] = Math.min(5, Math.max(1, base.scores[axis.id] + jitter));
    }
    out.push({ id: `demo_${i}`, scores });
  }
  return out;
}

init();
