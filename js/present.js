// Presenter view: big radar of the live group mean, plus the join code and QR
// for the room. Designed to be screenshared as-is.

import { AXES, ARCHETYPES, aggregate, meanScores } from './data.js';
import { Radar } from './radar.js';
import {
  renderLegend,
  renderMultiples,
  Tooltip,
  axisTooltipHtml,
} from './ui.js';
import * as store from './store.js';

const state = {
  code: '',
  agg: null,
  unsub: null,
  responses: [],
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
  if (code) {
    renderQr(code);
    // Still recorded, so the "earlier sessions" list can be restored later
    // without having lost the history in the meantime.
    store.rememberPresented(code);
  }
  // Keep the code in the URL so a refresh — or a second screen — lands in the
  // same session rather than minting a new one.
  const url = new URL(location.href);
  url.searchParams.set('session', code);
  history.replaceState(null, '', url);
}

/* ------------------------------------------------------------------ chart */

function seriesForMain() {
  const series = [];
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
  if (!state.agg || !state.agg.n) return [];
  return [{ label: `Group mean (n=${state.agg.n}, shaded ±1σ)`, className: 's-mean' }];
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
        state.responses = responses;
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

/* ----------------------------------------------------------------- export */

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * One row per respondent, one column per objective, plus the per-axis mean and
 * standard deviation as trailing rows so the file is readable on its own.
 */
function exportCsv() {
  if (!state.responses.length) {
    setStatus('Nothing to export yet — no responses in this session.');
    return;
  }
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const header = ['respondent', ...AXES.map((a) => a.label)];
  const rows = state.responses.map((r, i) => [
    `respondent_${i + 1}`,
    ...AXES.map((a) => r.scores?.[a.id] ?? ''),
  ]);
  if (state.agg) {
    const mean = (a) => {
      const m = state.agg.stats[a.id].mean;
      return typeof m === 'number' ? m.toFixed(3) : '';
    };
    rows.push(['mean', ...AXES.map(mean)]);
    rows.push(['sd', ...AXES.map((a) => state.agg.stats[a.id].sd.toFixed(3))]);
  }
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  download(`radar-${state.code}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
}

/* ------------------------------------------------------------------- init */

function init() {
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
        axisTooltipHtml(index, { agg: state.agg, yours: null, activeArchetypes: [] }),
        ev
      );
    },
  });

  document.getElementById('new-session').addEventListener('click', () => {
    const code = store.randomCode();
    state.agg = null;
    state.responses = [];
    setCode(code);
    draw();
    watch(code);
  });

  document.getElementById('export-csv').addEventListener('click', exportCsv);

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
    state.responses = fakeResponses(Math.min(demo, 40));
    state.agg = aggregate(state.responses);
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
