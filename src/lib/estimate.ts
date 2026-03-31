export const ESTIMATE_STATUS = [
  'Draft',
  'AI Processed',
  'Needs Human Review',
  'Review In Progress',
  'Internal Review Complete',
  'Client Version Ready',
  'Approved for Client Export',
  'Approved for Send',
  'Sent',
  'Opened',
  'Re-opened',
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUS)[number];

export const ESTIMATE_TYPES = ['trade', 'global'] as const;
export type EstimateType = (typeof ESTIMATE_TYPES)[number];

export const ESTIMATE_DOCUMENT_VERSIONS = [
  'client_trade',
  'client_global',
  'internal_review',
] as const;

export type EstimateDocumentVersion = (typeof ESTIMATE_DOCUMENT_VERSIONS)[number];

export const ESTIMATE_OPEN_EVENT_TYPES = [
  'portal_open',
  'pixel_open',
  'download_open',
  're_open',
] as const;

export type EstimateOpenEventType = (typeof ESTIMATE_OPEN_EVENT_TYPES)[number];

export interface EstimateCostItem {
  id: string;
  section?: string;
  description: string;
  quantity: number;
  unit: string;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  subcontractCost: number;
  subtotal: number;
  notes?: string;
}

export interface EstimatePricingSummary {
  directSubtotal: number;
  overheadPercent: number;
  overheadAmount: number;
  profitPercent: number;
  profitAmount: number;
  contingencyPercent: number;
  contingencyAmount: number;
  bondPercent: number;
  bondAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  validityDays: number;
  budgetary: boolean;
  proposalLabel: string;
}

export interface EstimateDraftPayload {
  title: string;
  executiveSummary: string;
  scopeOfWork: string;
  inclusions: string[];
  exclusions: string[];
  clarifications: string[];
  qualifications: string[];
  proposalNotes: string[];
  keyDocuments: string[];
  keyPlansAndSpecs: string[];
  costItems: EstimateCostItem[];
  pricingSummary: EstimatePricingSummary;
  internalAssumptions: string[];
  internalInferredData: string[];
  internalTechnicalBacking: string[];
  internalAnalysisNotes: string[];
  internalReviewComments: string[];
  clientDisclaimer: string;
  internalDisclaimer: string;
}

export interface EstimateTemplateBundle {
  clarifications: string[];
  qualifications: string[];
  proposalNotes: string[];
  clientDisclaimer: string;
  internalDisclaimer: string;
  proposalLabel: string;
  validForDays: number;
}

export const DEFAULT_TRADE_TEMPLATE: EstimateTemplateBundle = {
  clarifications: [
    'Pricing is based on standard working hours unless noted otherwise.',
    'No premium time, overtime, weekends, or holiday work is included unless specifically stated.',
    'Normal site access, staging, and coordination are assumed unless otherwise noted in the bid documents.',
    'No allowance is included for concealed conditions, unforeseen substrate repairs, or structural modifications unless specifically identified.',
  ],
  qualifications: [
    'Permits, bonds, taxes, freight, hoisting, temporary protection, patching, and final cleaning are excluded unless specifically listed in the pricing summary.',
    'Field dimensions, substrate conditions, and final quantities remain subject to verification before fabrication or procurement.',
    'This estimate is based on the drawings, specifications, addenda, and bid documents available at the time of preparation.',
  ],
  proposalNotes: [
    'Material pricing remains subject to supplier availability and market movement at time of award.',
    'Revisions may be required for addenda, scope changes, schedule shifts, or owner-directed alternates.',
  ],
  clientDisclaimer:
    'This estimate is prepared for budgeting and proposal review based on currently available bid package information. Final scope, quantities, field conditions, and executed contract requirements remain subject to confirmation before award.',
  internalDisclaimer:
    'Internal review copy. Includes inferred quantities, technical reasoning, assumptions, review comments, and working notes for estimator use only.',
  proposalLabel: 'Trade Estimate',
  validForDays: 30,
};

export const DEFAULT_GLOBAL_TEMPLATE: EstimateTemplateBundle = {
  clarifications: [
    'This document is a preliminary global analysis intended for budgeting guidance and internal scoping alignment.',
    'Detailed takeoff, vendor pricing, field verification, and trade buyout review are required before contract use.',
    'No premium time, acceleration, after-hours work, or extraordinary logistics are included unless specifically stated.',
  ],
  qualifications: [
    'Budget figures remain subject to addenda, scope clarification, schedule sequencing, procurement timing, and market volatility.',
    'Discipline subtotals are directional and should not be treated as subcontract commitments without detailed review.',
    'Unforeseen concealed conditions, utility conflicts, structural modifications, permitting, bonds, taxes, freight, and temporary facilities are excluded unless explicitly listed.',
  ],
  proposalNotes: [
    'Use this document as a budgetary estimate and preliminary global analysis only.',
    'Not for contract execution without detailed takeoff, estimator review, and commercial alignment.',
  ],
  clientDisclaimer:
    'Budgetary estimate only. This preliminary global analysis is provided for planning purposes and is not intended for contract use without detailed takeoff, estimator review, and final scope confirmation.',
  internalDisclaimer:
    'Internal review copy. Includes assumptions, inferred data, technical backing, and discipline-level working notes.',
  proposalLabel: 'Budgetary Estimate',
  validForDays: 30,
};

const CLIENT_BANNED_PHRASES = [
  /ai inference/gi,
  /inferred qty/gi,
  /confidence\s*\d+%/gi,
  /appears to be/gi,
  /detected from file names/gi,
  /extracted text and discipline matches/gi,
  /inferred/gi,
];

export function findClientFacingLanguageIssues(value: string | null | undefined): string[] {
  const source = value?.trim();
  if (!source) {
    return [];
  }

  const matches = CLIENT_BANNED_PHRASES.flatMap((pattern) => {
    pattern.lastIndex = 0;
    const found = source.match(pattern) ?? [];
    pattern.lastIndex = 0;
    return found.map((item) => item.trim());
  });

  return [...new Set(matches.filter(Boolean))];
}

export function sanitizeClientFacingText(value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) {
    return '';
  }

  let sanitized = source;
  for (const pattern of CLIENT_BANNED_PHRASES) {
    sanitized = sanitized.replace(pattern, '');
  }

  sanitized = sanitized
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .trim();

  return sanitized;
}

export function toCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatEstimateDate(value: Date | string | null | undefined): string {
  if (!value) {
    return 'TBD';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'TBD';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatEstimateStatusLabel(status: string, openCount = 0): string {
  if (status === 'Sent' && openCount > 0) {
    return openCount > 1 ? 'Re-opened' : 'Opened';
  }
  return status;
}

export function isClientDocumentVersion(documentVersion: EstimateDocumentVersion): boolean {
  return documentVersion === 'client_trade' || documentVersion === 'client_global';
}

export function isDocumentVersionAllowedForEstimate(
  estimateType: EstimateType,
  documentVersion: EstimateDocumentVersion,
): boolean {
  if (documentVersion === 'internal_review') {
    return true;
  }

  return (
    (estimateType === 'trade' && documentVersion === 'client_trade') ||
    (estimateType === 'global' && documentVersion === 'client_global')
  );
}

export function getDocumentVersionLabel(documentVersion: EstimateDocumentVersion): string {
  switch (documentVersion) {
    case 'client_trade':
      return 'Client Trade Estimate';
    case 'client_global':
      return 'Client Global Estimate';
    case 'internal_review':
      return 'Internal Review PDF';
    default:
      return documentVersion;
  }
}
