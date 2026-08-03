// Data for the Language AI policy priorities radar.
//
// Source: Ntampaka et al., "How to Craft the Right Language AI Policy For Your
// Research Group (Some Assembly Required)", arXiv:2607.20836, Figure 1.
//
// Eleven objectives, each rated 1 (low priority) to 5 (highly prioritised).
// Axis order runs clockwise from the top, matching Figure 1 — which groups the
// four themes into contiguous arcs.

export const SCALE = { min: 1, max: 5 };

export const THEMES = {
  productivity: { label: 'Research Productivity', section: '§3' },
  development: { label: 'Scientist Development', section: '§4' },
  integrity: { label: 'Scientific Integrity', section: '§5' },
  governance: { label: 'Data Governance', section: '§6' },
};

export const AXES = [
  {
    id: 'fair_research_culture',
    label: 'Fair Research Culture',
    theme: 'development',
    section: '§4.1',
    blurb:
      'A healthy, sustainable research culture — recognising that the costs of ' +
      'undisclosed AI use, and the pressure to use it, fall unevenly across career stages.',
  },
  {
    id: 'meaningful_human_ownership',
    label: 'Meaningful Human Ownership',
    theme: 'development',
    section: '§4.2',
    blurb:
      'Researchers can explain and defend how a result was produced, and take ' +
      'full responsibility for its interpretation.',
  },
  {
    id: 'retained_human_expertise',
    label: 'Retained Human Expertise',
    theme: 'development',
    section: '§4.3',
    blurb:
      'The group retains the skills needed to do its science — expertise is built ' +
      'through practice and failure, and delegating the work erodes it.',
  },
  {
    id: 'human_evaluation',
    label: 'Human Evaluation',
    theme: 'integrity',
    section: '§5.1',
    blurb:
      'Outputs are independently checked by people. A plausible-looking answer is ' +
      'not enough; results must meet the evidentiary standards of scientific work.',
  },
  {
    id: 'transparency_disclosure',
    label: 'Transparency & Disclosure',
    theme: 'integrity',
    section: '§5.2',
    blurb:
      'Documenting which tools were used, what for, what was accepted or rejected, ' +
      'and how outputs were modified.',
  },
  {
    id: 'academic_integrity',
    label: 'Academic Integrity',
    theme: 'integrity',
    section: '§5.3',
    blurb:
      'Meeting the standards of authorship, attribution and honesty that the ' +
      'scientific community expects.',
  },
  {
    id: 'security',
    label: 'Security',
    theme: 'governance',
    section: '§6.1',
    blurb:
      'Protecting the systems, credentials and infrastructure entrusted to the group ' +
      'when AI tools are introduced into the workflow.',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    theme: 'governance',
    section: '§6.2',
    blurb:
      'Protecting proprietary, embargoed, personal or otherwise sensitive data from ' +
      'exposure through third-party tools.',
  },
  {
    id: 'data_integrity',
    label: 'Data Integrity',
    theme: 'governance',
    section: '§6.3',
    blurb:
      'Keeping data and derived products correct, traceable and uncorrupted, so ' +
      'others can evaluate and build on the results.',
  },
  {
    id: 'operational_efficiency',
    label: 'Operational Efficiency',
    theme: 'productivity',
    section: '§3.1',
    blurb:
      'Reducing bottlenecks, streamlining workflows, and directing limited effort ' +
      'toward the activities that advance the science.',
  },
  {
    id: 'thoughtful_resource_usage',
    label: 'Thoughtful Resource Usage',
    theme: 'productivity',
    section: '§3.2',
    blurb:
      'Weighing whether AI genuinely saves scarce resources — researcher time, ' +
      'compute, money, attention — rather than quietly consuming more.',
  },
];

export const AXIS_IDS = AXES.map((a) => a.id);

// ---------------------------------------------------------------------------
// Archetype reference profiles.
//
// IMPORTANT: the paper does not tabulate these numbers — they are read off the
// Figure 1 radar by eye, so treat them as indicative rather than exact. They are
// deliberately isolated here so they are trivial to correct: change a number and
// every view updates.
//
// Dash patterns mirror the paper's line styles (solid / dashed / dash-dot /
// dotted) and carry the identity, since all four render in recessive grey.
// ---------------------------------------------------------------------------

export const ARCHETYPES = [
  {
    id: 'high_leverage',
    label: 'High Leverage',
    dash: [],
    optimises: 'Throughput & efficiency',
    question: 'Does this help us accomplish our goals efficiently?',
    aiRole: 'Force multiplier',
    tradesAway: 'Training & oversight',
    scores: {
      fair_research_culture: 3,
      meaningful_human_ownership: 1,
      retained_human_expertise: 1,
      human_evaluation: 2,
      transparency_disclosure: 2,
      academic_integrity: 3,
      security: 1,
      privacy: 1,
      data_integrity: 2,
      operational_efficiency: 5,
      thoughtful_resource_usage: 5,
    },
  },
  {
    id: 'craftsmanship',
    label: 'Craftsmanship',
    dash: [7, 4],
    optimises: 'Expertise development',
    question: 'Are we developing capable researchers?',
    aiRole: 'Tutor',
    tradesAway: 'Efficiency',
    scores: {
      fair_research_culture: 5,
      meaningful_human_ownership: 5,
      retained_human_expertise: 5,
      human_evaluation: 4,
      transparency_disclosure: 2,
      academic_integrity: 3,
      security: 1,
      privacy: 1,
      data_integrity: 2,
      operational_efficiency: 2,
      thoughtful_resource_usage: 2,
    },
  },
  {
    id: 'trustworthiness',
    label: 'Trustworthiness',
    dash: [8, 3, 2, 3],
    optimises: 'Rigour & reproducibility',
    question: 'Can we stand behind this result?',
    aiRole: 'Assistant under review',
    tradesAway: 'Speed',
    scores: {
      fair_research_culture: 3,
      meaningful_human_ownership: 3,
      retained_human_expertise: 4,
      human_evaluation: 5,
      transparency_disclosure: 5,
      academic_integrity: 5,
      security: 4,
      privacy: 4,
      data_integrity: 4,
      operational_efficiency: 2,
      thoughtful_resource_usage: 2,
    },
  },
  {
    id: 'data_stewardship',
    label: 'Data Stewardship',
    dash: [2, 3],
    optimises: 'Security & responsibility',
    question: 'Is this approach secure, compliant and responsible?',
    aiRole: 'Controlled tool',
    tradesAway: 'Convenience',
    scores: {
      fair_research_culture: 2,
      meaningful_human_ownership: 2,
      retained_human_expertise: 2,
      human_evaluation: 3,
      transparency_disclosure: 5,
      academic_integrity: 3,
      security: 5,
      privacy: 5,
      data_integrity: 5,
      operational_efficiency: 2,
      thoughtful_resource_usage: 3,
    },
  },
];

export const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

/** Neutral starting point for a fresh respondent: the midpoint of the scale. */
export function defaultScores() {
  const mid = Math.round((SCALE.min + SCALE.max) / 2);
  return Object.fromEntries(AXIS_IDS.map((id) => [id, mid]));
}

/**
 * Similarity between a response and an archetype, as 0-100 so it reads naturally
 * in the UI. Based on Euclidean distance across the eleven axes.
 */
export function similarityToArchetype(scores, archetype) {
  let sumSq = 0;
  for (const id of AXIS_IDS) {
    const d = (scores[id] ?? 0) - archetype.scores[id];
    sumSq += d * d;
  }
  const dist = Math.sqrt(sumSq);
  // Worst case: every axis off by the full scale range.
  const maxDist = Math.sqrt(AXIS_IDS.length * (SCALE.max - SCALE.min) ** 2);
  return Math.max(0, Math.round((1 - dist / maxDist) * 100));
}

/**
 * Aggregate a list of response objects into per-axis mean, standard deviation
 * and range. Returns null when there is nothing to aggregate.
 */
export function aggregate(responses) {
  if (!responses.length) return null;
  const stats = {};
  for (const id of AXIS_IDS) {
    const vals = responses
      .map((r) => r.scores?.[id])
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (!vals.length) {
      stats[id] = { mean: null, sd: 0, min: null, max: null, n: 0 };
      continue;
    }
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    // Population SD: this is the whole group, not a sample from a wider one.
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    stats[id] = { mean, sd, min: Math.min(...vals), max: Math.max(...vals), n };
  }
  return { n: responses.length, stats };
}

/** Mean scores as a plain {axisId: value} map, for distance calculations. */
export function meanScores(agg) {
  if (!agg) return null;
  return Object.fromEntries(AXIS_IDS.map((id) => [id, agg.stats[id].mean ?? 0]));
}
