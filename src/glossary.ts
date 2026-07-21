// Domain jargon, defined for someone who has never encountered any of it.
// Rendered as click-to-open popovers via [data-term] spans.

export interface Term {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, Term> = {
  'building approval': {
    term: 'Building approval',
    definition:
      'Approval by a council or private certifier for building work to go ahead — the point at which a new home is cleared to be built. It is the earliest stage the ABS measures: approvals happen before construction starts (a commencement) and long before the home is finished (a completion). Not every approval is built, and a big project can be approved months or years before the first slab is poured.',
  },
  'dwelling unit': {
    term: 'Dwelling unit',
    definition:
      'One self-contained place to live. A single detached house is one dwelling; a 60-apartment tower is 60 dwellings in one building. This site counts dwelling units, not buildings, so a region can approve few buildings but many homes.',
  },
  house: {
    term: 'Detached house',
    definition:
      'A standalone house on its own block — the classic suburban home. In ABS terms, building type 110. Detached houses dominate approvals in outer-suburban growth corridors and regional areas.',
  },
  'non-house': {
    term: 'Non-house dwellings',
    definition:
      'Everything that is not a detached house: townhouses, semi-detached and terrace houses, and apartments. These are the higher-density forms that cluster in and around city centres. A high non-house share is the signature of urban infill.',
  },
  apartment: {
    term: 'Apartment',
    definition:
      'A dwelling in a block of flats or units (ABS building type 130). Apartment approvals are volatile — a single large tower can swing a region’s numbers for a month — and they concentrate in inner-city SA3s like Melbourne City and Sydney Inner City.',
  },
  townhouse: {
    term: 'Townhouse',
    definition:
      'A semi-detached, row or terrace house, or townhouse (ABS building type 120) — attached to a neighbour but usually with its own entrance and often two or more storeys. The “missing middle” between detached houses and apartments.',
  },
  'new residential': {
    term: 'New residential',
    definition:
      'This site counts only NEW residential dwellings approved. It excludes alterations and additions, conversions, and non-residential buildings (offices, warehouses, schools). It is the measure of new housing supply entering the pipeline.',
  },
  sa3: {
    term: 'SA3 region',
    definition:
      'Statistical Area Level 3 — an ABS geography of roughly 30,000 to 130,000 people, about the size of a large suburb cluster or a regional town and its surrounds. Fine enough to be recognisable, coarse enough to be stable month to month. There are about 340 of them nationally.',
  },
  'per 10,000 residents': {
    term: 'Rate per 10,000 residents',
    definition:
      'New dwellings approved over the last twelve months divided by the resident population, times 10,000. Raw counts mostly measure how many people already live somewhere; the rate is what makes a booming growth corridor comparable to an established suburb. A rate of 100 means one new home approved per 100 residents in a year.',
  },
  'trailing 12 months': {
    term: 'Trailing 12 months',
    definition:
      'The most recent twelve months, summed. A single month is small and seasonal for one region, so a month-by-month ranking reshuffles on noise. Every headline figure here uses the twelve-month window, which also cancels out the summer slowdown.',
  },
  'housing accord': {
    term: 'National Housing Accord',
    definition:
      'A 2022 agreement between the Commonwealth, states and industry to build 1.2 million new, well-located homes in the five years from 1 July 2024 — an average of 240,000 a year, or about 20,000 a month. Crucially the target counts COMPLETED homes, not approvals. Approvals are the leading indicator: they must run at least as high as the target (and higher, to cover the approvals that never get built) for completions to keep pace. The benchmark line on this site shows that 20,000-a-month pace as a reference, not as a claim that approvals alone meet the target.',
  },
  commencement: {
    term: 'Commencement vs completion',
    definition:
      'A commencement is when construction physically starts; a completion is when the home is finished and ready to live in. Approvals lead commencements by months and completions by a year or more. Because some approved projects stall or are abandoned, completions always end up below approvals — which is why approvals running below the Accord target is an early warning sign.',
  },
  value: {
    term: 'Value of building approved',
    definition:
      'The estimated cost of the building work approved (excluding land), as reported to the ABS. It is a rough gauge of investment flowing into a region, but it is driven by construction costs and project size as much as by the number of homes, so dwelling counts are the fairer supply measure.',
  },
};

/** Wrap a term in an info-icon trigger. `key` must exist in GLOSSARY. */
export function gloss(key: string, label?: string): string {
  const t = GLOSSARY[key];
  if (!t) return label ?? key;
  return `<span class="glossary-link" data-term="${key}" tabindex="0" role="button" aria-label="Definition of ${t.term}">${label ?? t.term}<span class="gloss-icon" aria-hidden="true">i</span></span>`;
}

let popover: HTMLDivElement | null = null;

function ensurePopover(): HTMLDivElement {
  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'glossary-popover';
    popover.setAttribute('role', 'dialog');
    document.body.appendChild(popover);
  }
  return popover;
}

export function hideGlossary(): void {
  popover?.classList.remove('visible');
}

function show(trigger: Element): void {
  const key = trigger.getAttribute('data-term') ?? '';
  const t = GLOSSARY[key];
  if (!t) return;
  const el = ensurePopover();
  el.innerHTML = `<h4></h4><p></p>`;
  (el.querySelector('h4') as HTMLElement).textContent = t.term;
  (el.querySelector('p') as HTMLElement).textContent = t.definition;
  el.classList.add('visible');

  const r = trigger.getBoundingClientRect();
  const pr = el.getBoundingClientRect();
  let left = r.left;
  let top = r.bottom + 8;
  if (left + pr.width > window.innerWidth - 12) left = window.innerWidth - pr.width - 12;
  if (top + pr.height > window.innerHeight - 12) top = r.top - pr.height - 8;
  el.style.left = `${Math.max(12, left)}px`;
  el.style.top = `${Math.max(12, top)}px`;
}

export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest('.glossary-link');
    if (trigger) {
      e.stopPropagation();
      show(trigger);
      return;
    }
    if (!(e.target as Element).closest('.glossary-popover')) hideGlossary();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideGlossary();
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element)?.classList?.contains('glossary-link')) {
      e.preventDefault();
      show(e.target as Element);
    }
  });
  window.addEventListener('resize', hideGlossary);
}
