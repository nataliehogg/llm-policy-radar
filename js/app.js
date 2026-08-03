// Participant page: rate the eleven objectives, compare with the archetypes,
// and optionally submit into a shared session.

import { AXES, defaultScores } from './data.js';
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
  // Deliberately NOT the group's scores — only how many have been submitted.
  // Showing a live group mean here would anchor people: early votes would pull
  // later ones toward an average that is itself still moving. The presenter
  // view is where the group profile gets revealed, when the presenter chooses.
  responseCount: 0,
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

function draw() {
  radar.setSeries([{ id: 'you', className: 's-you', scores: state.scores, markers: true }]);
  radar.syncAria(state.scores);
  syncReadout(state.scores);
  renderLegend(document.getElementById('legend'), [{ label: 'You', className: 's-you' }]);
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
  state.responseCount = 0;
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
  state.responseCount = 0;
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
        state.responseCount = responses.length;
        const mine = responses.some((r) => r.id === store.getClientId());
        state.submitted = mine;
        document.getElementById('submit-btn').textContent = mine
          ? 'Update my scores'
          : 'Submit my scores';
        setStatus(
          `Live in <strong>${code}</strong> — ${state.responseCount} response${
            state.responseCount === 1 ? '' : 's'
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
        axisTooltipHtml(index, { agg: null, yours: state.scores, activeArchetypes: [] }),
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
