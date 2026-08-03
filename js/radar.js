// SVG radar renderer.
//
// Colour is intentionally NOT passed in as hex: every stroke and fill resolves
// from CSS custom properties via the series' class name, so light/dark theming
// lives in one place in the stylesheet.

import { AXES, SCALE } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

// Leaves a small hole at the centre so a value of 1 is still a visible polygon
// rather than collapsing to a point, matching the paper's figure.
const INNER_FRACTION = 0.12;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
}

/** Angle for axis i, starting at 12 o'clock and running clockwise. */
function angleFor(i, n) {
  return -Math.PI / 2 + (i / n) * TAU;
}

/** Wrap a label into short lines so long axis names do not collide. */
function wrapLabel(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export class Radar {
  /**
   * @param {SVGElement} svg    target <svg> element
   * @param {object} opts
   *   size        - viewBox size in user units (square)
   *   labels      - render axis labels (off for small multiples)
   *   ticks       - render the 1..5 scale numbers
   *   labelChars  - wrap width for axis labels
   *   onHover     - callback(axisIndex|null, clientX, clientY)
   */
  constructor(svg, opts = {}) {
    this.svg = svg;
    this.opts = {
      size: 520,
      labels: true,
      ticks: true,
      labelChars: 14,
      onHover: null,
      ...opts,
    };
    this.n = AXES.length;
    this.series = [];
    this._buildFrame();
  }

  get center() {
    return this.opts.size / 2;
  }

  get maxRadius() {
    // Leave room for labels outside the plot when they are shown.
    return this.opts.labels ? this.opts.size * 0.35 : this.opts.size * 0.44;
  }

  get innerRadius() {
    return this.maxRadius * INNER_FRACTION;
  }

  /** Map a 1..5 value to a radius. */
  radiusFor(value) {
    const t = (value - SCALE.min) / (SCALE.max - SCALE.min);
    return this.innerRadius + (this.maxRadius - this.innerRadius) * t;
  }

  pointFor(axisIndex, value) {
    const a = angleFor(axisIndex, this.n);
    const r = this.radiusFor(value);
    return [this.center + r * Math.cos(a), this.center + r * Math.sin(a)];
  }

  _buildFrame() {
    const { size, labels, ticks, labelChars } = this.opts;
    const svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.replaceChildren();

    const gGrid = el('g', { class: 'radar-grid-layer' });
    const gSeries = el('g', { class: 'radar-series-layer' });
    const gLabels = el('g', { class: 'radar-label-layer' });
    const gHit = el('g', { class: 'radar-hit-layer' });

    // Concentric rings, one per scale step. Solid hairlines, never dashed.
    for (let v = SCALE.min; v <= SCALE.max; v++) {
      const r = this.radiusFor(v);
      const pts = [];
      for (let i = 0; i < this.n; i++) {
        const a = angleFor(i, this.n);
        pts.push(`${this.center + r * Math.cos(a)},${this.center + r * Math.sin(a)}`);
      }
      gGrid.appendChild(
        el('polygon', {
          points: pts.join(' '),
          class: v === SCALE.max ? 'radar-ring radar-ring--outer' : 'radar-ring',
        })
      );
    }

    // Spokes.
    for (let i = 0; i < this.n; i++) {
      const [x, y] = this.pointFor(i, SCALE.max);
      gGrid.appendChild(
        el('line', { x1: this.center, y1: this.center, x2: x, y2: y, class: 'radar-spoke' })
      );
    }

    // Scale numbers, placed along the axis that points due right in Figure 1.
    // These go in the label layer, above the series, with a surface-coloured
    // halo — otherwise a polygon crossing the axis hides the number underneath.
    if (ticks) {
      const tickAxis = 3; // Human Evaluation sits at ~3 o'clock for 11 axes
      for (let v = SCALE.min; v <= SCALE.max; v++) {
        const [x, y] = this.pointFor(tickAxis, v);
        gLabels.appendChild(
          Object.assign(el('text', { x, y: y - 5, class: 'radar-tick' }), {
            textContent: String(v),
          })
        );
      }
    }

    // Axis labels, anchored by which side of the circle they fall on.
    if (labels) {
      const labelRadius = this.maxRadius * 1.12;
      AXES.forEach((axis, i) => {
        const a = angleFor(i, this.n);
        const x = this.center + labelRadius * Math.cos(a);
        const y = this.center + labelRadius * Math.sin(a);
        const cos = Math.cos(a);
        let anchor = 'middle';
        if (cos > 0.15) anchor = 'start';
        else if (cos < -0.15) anchor = 'end';

        const lines = wrapLabel(axis.label, labelChars);
        const lineHeight = 13;
        // Vertically centre the block on the anchor point.
        const y0 = y - ((lines.length - 1) * lineHeight) / 2;
        const text = el('text', {
          x,
          y: y0,
          'text-anchor': anchor,
          class: `radar-label radar-label--${axis.theme}`,
        });
        lines.forEach((line, li) => {
          const tspan = el('tspan', { x, dy: li === 0 ? 0 : lineHeight });
          tspan.textContent = line;
          text.appendChild(tspan);
        });
        gLabels.appendChild(text);
      });
    }

    svg.append(gGrid, gSeries, gLabels, gHit);
    this._gSeries = gSeries;
    this._gHit = gHit;

    if (this.opts.onHover) this._buildHitAreas();
  }

  /**
   * One invisible wedge per axis. The hit target is the whole sector, so it is
   * never a pinpoint chase even on a small radar.
   */
  _buildHitAreas() {
    const half = TAU / this.n / 2;
    const R = this.maxRadius * 1.28;
    for (let i = 0; i < this.n; i++) {
      const a = angleFor(i, this.n);
      const [x1, y1] = [this.center + R * Math.cos(a - half), this.center + R * Math.sin(a - half)];
      const [x2, y2] = [this.center + R * Math.cos(a + half), this.center + R * Math.sin(a + half)];
      const wedge = el('path', {
        d: `M ${this.center} ${this.center} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`,
        class: 'radar-hit',
        'data-axis-index': i,
        tabindex: '0',
        role: 'button',
        'aria-label': AXES[i].label,
      });
      const enter = (ev) => this.opts.onHover(i, ev);
      const leave = (ev) => this.opts.onHover(null, ev);
      wedge.addEventListener('pointerenter', enter);
      wedge.addEventListener('pointermove', enter);
      wedge.addEventListener('pointerleave', leave);
      // Keyboard focus surfaces exactly what hover does.
      wedge.addEventListener('focus', enter);
      wedge.addEventListener('blur', leave);
      this._gHit.appendChild(wedge);
    }
  }

  /**
   * Replace all plotted series.
   *
   * @param {Array} series - each { id, className, scores, dash, fill, band, label }
   *   scores - {axisId: value}
   *   band   - optional {axisId: [lo, hi]} drawn as a translucent spread ribbon
   */
  setSeries(series) {
    this.series = series;
    const g = this._gSeries;
    g.replaceChildren();

    for (const s of series) {
      if (s.band) {
        const outer = [];
        const inner = [];
        AXES.forEach((axis, i) => {
          const [lo, hi] = s.band[axis.id] ?? [null, null];
          if (lo === null) return;
          outer.push(this.pointFor(i, hi).join(','));
          inner.unshift(this.pointFor(i, lo).join(','));
        });
        if (outer.length === this.n) {
          g.appendChild(
            el('path', {
              d: `M ${outer.join(' L ')} Z M ${inner.join(' L ')} Z`,
              'fill-rule': 'evenodd',
              class: `radar-band ${s.className}-band`,
            })
          );
        }
      }

      const pts = AXES.map((axis, i) => {
        const v = s.scores[axis.id];
        return this.pointFor(i, Number.isFinite(v) ? v : SCALE.min).join(',');
      });

      if (s.fill !== false) {
        g.appendChild(
          el('polygon', { points: pts.join(' '), class: `radar-area ${s.className}-area` })
        );
      }
      g.appendChild(
        el('polygon', {
          points: pts.join(' '),
          class: `radar-line ${s.className}-line`,
          'stroke-dasharray': s.dash && s.dash.length ? s.dash.join(' ') : null,
        })
      );

      if (s.markers) {
        AXES.forEach((axis, i) => {
          const v = s.scores[axis.id];
          if (!Number.isFinite(v)) return;
          const [x, y] = this.pointFor(i, v);
          g.appendChild(el('circle', { cx: x, cy: y, r: 4.5, class: `radar-dot ${s.className}-dot` }));
        });
      }
    }
  }

  /** Highlight the spoke under the cursor. */
  setActiveAxis(index) {
    const spokes = this.svg.querySelectorAll('.radar-spoke');
    spokes.forEach((sp, i) => sp.classList.toggle('is-active', i === index));
  }
}
