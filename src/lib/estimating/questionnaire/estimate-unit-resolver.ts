const PRICING_UNIT_LABELS: Record<string, string> = {
  lf: 'Per Linear Foot (LF)',
  sf: 'Per Square Foot (SF)',
  cy: 'Per Cubic Yard (CY)',
  ea: 'Per Piece / Unit',
  piece: 'Per Piece',
  post: 'Per Post',
  panel: 'Per Panel',
  project: 'Per Lot / Project',
  lot: 'Per Lot',
  bag: 'Per Bag',
  truck: 'Per Truck',
  strip: 'Per Strip / Run',
  opening: 'Per Opening',
  set: 'Per Door Set',
  sheet: 'Per Sheet',
  system: 'Per System',
  ton: 'Per Ton',
  circuit: 'Per Circuit',
  panelboard: 'Per Panel',
  panelboards: 'Per Panel',
  fixture: 'Per Fixture',
};

const LABOR_MODEL_LABELS: Record<string, string> = {
  hour: 'Per Hour',
  day: 'Per Day',
  person: 'Per Person',
  crew: 'Per Crew',
  project: 'Per Project',
};

export function resolvePricingUnitLabel(value: string | null | undefined) {
  return PRICING_UNIT_LABELS[value || ''] || value || 'Per Project';
}

export function resolveLaborModelLabel(value: string | null | undefined) {
  return LABOR_MODEL_LABELS[value || ''] || value || 'Per Crew';
}
