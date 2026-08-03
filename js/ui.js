// Shared UI pieces used by both the participant page and the presenter view.

import { AXES, ARCHETYPES, rankArchetypes, formatR } from './data.js';
import { Radar } from './radar.js';

/**
 * Legend swatches drawn as SVG so the dash pattern — which is what distinguishes
 * the four archetypes — is visible in the legend itself, not just on the chart.
 */
export function renderLegend(container, entries) {
  container.replaceChildren();
  for (const e of entries) {
    const li = document.createElement('li');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '12');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '1');
    line.setAttribute('y1', '6');
    line.setAttribute('x2', '25');
    line.setAttribute('y2', '6');
    line.setAttribute('class', `radar-line ${e.className}-line`);
    if (e.dash && e.dash.length) line.setAttribute('stroke-dasharray', e.dash.join(' '));
    svg.appendChild(line);
    li.append(svg, document.createTextNode(e.label));
    container.appendChild(li);
  }
}

/** Tooltip controller shared by every radar on the page. */
export class Tooltip {
  constructor(node) {
    this.node = node;
  }

  show(html, ev) {
    this.node.innerHTML = html;
    this.node.classList.add('is-visible');
    this.node.setAttribute('aria-hidden', 'false');
    this.move(ev);
  }

  move(ev) {
    const pad = 14;
    const rect = this.node.getBoundingClientRect();
    // Fall back to the element's own position for keyboard focus events, which
    // carry no pointer coordinates.
    let x = ev && ev.clientX;
    let y = ev && ev.clientY;
    if (x === undefined || x === null || (x === 0 && y === 0)) {
      const target = ev && ev.target && ev.target.getBoundingClientRect
        ? ev.target.getBoundingClientRect()
        : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      x = target.left + target.width / 2;
      y = target.top + target.height / 2;
    }
    let left = x + pad;
    let top = y + pad;
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
    this.node.style.left = `${Math.max(8, left)}px`;
    this.node.style.top = `${Math.max(8, top)}px`;
  }

  hide() {
    this.node.classList.remove('is-visible');
    this.node.setAttribute('aria-hidden', 'true');
  }
}

const fmt = (v, dp = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(dp));

/** Tooltip body for an axis, given whichever of the three data sources exist. */
export function axisTooltipHtml(axisIndex, { agg, yours, activeArchetypes }) {
  const axis = AXES[axisIndex];
  const rows = [];
  if (agg && agg.stats[axis.id].n) {
    const s = agg.stats[axis.id];
    rows.push(['Group mean', fmt(s.mean, 2)]);
    rows.push(['Spread (±1σ)', `${fmt(s.mean - s.sd, 1)}–${fmt(s.mean + s.sd, 1)}`]);
    rows.push(['Range', `${s.min}–${s.max}`]);
    rows.push(['Responses', String(s.n)]);
  }
  if (yours) rows.push(['You', String(yours[axis.id])]);
  for (const a of activeArchetypes || []) {
    rows.push([a.label, String(a.scores[axis.id])]);
  }

  return `
    <h3>${axis.label}</h3>
    <p class="small muted" style="margin:0">${axis.section} · ${axis.blurb}</p>
    ${
      rows.length
        ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`
        : ''
    }
  `;
}

/**
 * Table twin of the chart — every plotted value is reachable without relying on
 * colour or hover.
 */
export function renderTable(table, { agg, yours, archetypes }) {
  const showGroup = Boolean(agg && agg.n);
  const head = ['Objective', 'Theme'];
  if (yours) head.push('You');
  if (showGroup) head.push('Group mean', 'σ', 'Range');
  for (const a of archetypes || []) head.push(a.label);

  const thead = `<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>`;

  const body = AXES.map((axis) => {
    const cells = [`<th scope="row">${axis.label}</th>`, `<td>${axis.section}</td>`];
    if (yours) cells.push(`<td>${yours[axis.id]}</td>`);
    if (showGroup) {
      const s = agg.stats[axis.id];
      cells.push(`<td>${fmt(s.mean, 2)}</td>`);
      cells.push(`<td>${fmt(s.sd, 2)}</td>`);
      cells.push(`<td>${s.n ? `${s.min}–${s.max}` : '—'}</td>`);
    }
    for (const a of archetypes || []) cells.push(`<td>${a.scores[axis.id]}</td>`);
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  table.innerHTML = `${thead}<tbody>${body}</tbody>`;
}

/**
 * Four small radars, one per archetype, each with the live profile drawn over
 * that archetype's reference outline. This is how more than three reference
 * profiles get compared without putting four competing hues in one plot.
 */
export function renderMultiples(container, scores, opts = {}) {
  const className = opts.className || 's-you';
  const ranked = scores
    ? rankArchetypes(scores)
    : ARCHETYPES.map((archetype) => ({ archetype, r: null }));

  container.replaceChildren();
  for (const { archetype, r } of ranked) {
    const fig = document.createElement('figure');
    fig.className = 'multiple';
    fig.style.margin = '0';

    const holder = document.createElement('div');
    holder.className = 'radar-holder';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.appendChild(svg);

    const cap = document.createElement('figcaption');
    // Always render the value line, even when r is undefined, so the panels do
    // not change height the moment a rating is dragged.
    cap.innerHTML =
      `<h3>${archetype.label}</h3><span class="sub">Pearson r = ${formatR(r)}</span>`;

    fig.append(holder, cap);
    container.appendChild(fig);

    const radar = new Radar(svg, { size: 200, labels: false, ticks: false });
    const series = [
      {
        id: archetype.id,
        className: 's-archetype',
        scores: archetype.scores,
        dash: archetype.dash,
        fill: false,
      },
    ];
    if (scores) series.push({ id: 'live', className, scores, fill: true });
    radar.setSeries(series);
  }
}

/** Bar list ranking the archetypes by similarity to the current profile. */
export function renderRanks(container, scores) {
  container.replaceChildren();
  if (!scores) return;

  for (const { archetype, r } of rankArchetypes(scores)) {
    const li = document.createElement('li');
    // The track spans r = -1 to +1 with zero at the midpoint, so the direction
    // of the bar carries the sign and the number disambiguates it.
    const half = r === null ? 0 : Math.abs(r) * 50;
    const left = r === null ? 50 : r >= 0 ? 50 : 50 - half;
    li.innerHTML = `
      <span class="rank-name">${archetype.label}</span>
      <span class="rank-value">${r === null ? '—' : `r = ${formatR(r)}`}</span>
      <span class="bar-track bar-track--diverging">
        <span class="bar-zero"></span>
        <span class="bar-fill" style="left:${left}%; width:${half}%"></span>
      </span>
    `;
    container.appendChild(li);
  }
}

/**
 * Read-only value list, grouped by theme. The radar itself is the input now, so
 * this exists to keep every number visible at a glance and to give the axis
 * descriptions somewhere permanent to live.
 */
export function renderReadout(container, scores, onHighlight) {
  const order = ['productivity', 'development', 'integrity', 'governance'];
  const themeLabels = {
    productivity: 'Research Productivity (§3)',
    development: 'Scientist Development (§4)',
    integrity: 'Scientific Integrity (§5)',
    governance: 'Data Governance (§6)',
  };

  container.replaceChildren();

  for (const theme of order) {
    const group = document.createElement('div');
    group.className = 'theme-group';
    const title = document.createElement('p');
    title.className = 'theme-title';
    title.textContent = themeLabels[theme];
    group.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'axis-list';

    for (const axis of AXES.filter((a) => a.theme === theme)) {
      const li = document.createElement('li');
      li.className = 'axis-item readout-item';
      li.dataset.axisId = axis.id;
      li.innerHTML = `
        <div class="axis-head">
          <span class="axis-name">${axis.label} <span class="axis-section">${axis.section}</span></span>
          <span class="axis-value" id="val-${axis.id}">${scores[axis.id]}</span>
        </div>
        <p class="axis-blurb">${axis.blurb}</p>
      `;
      if (onHighlight) {
        li.addEventListener('pointerenter', () => onHighlight(AXES.indexOf(axis)));
        li.addEventListener('pointerleave', () => onHighlight(null));
      }
      list.appendChild(li);
    }
    group.appendChild(list);
    container.appendChild(group);
  }
}

/** Update just the numbers in the readout. */
export function syncReadout(scores) {
  for (const axis of AXES) {
    const val = document.getElementById(`val-${axis.id}`);
    if (val) val.textContent = String(scores[axis.id]);
  }
}
