import type { Estimate, Project } from '@prisma/client';
import {
  formatEstimateDate,
  sanitizeClientFacingText,
  type EstimateCostItem,
  type EstimateDocumentVersion,
  type EstimatePricingSummary,
} from '@/lib/estimate';
import type { EstimateQuestionnaireState } from '@/lib/estimating/questionnaire/questionnaire-types';
import { safeJsonParse } from '@/lib/server/json';
import { exportEstimatePdf } from '@/server/estimates/export-estimate-service';

type EstimateDocumentSource = {
  project: Project;
  estimate: Estimate;
};

export interface EstimateDocumentContext {
  projectId: string;
  estimateId: string;
  estimateNumber: string;
  estimateType: string;
  title: string;
  versionLabel: string;
  status: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  projectName: string;
  clientName: string;
  location: string;
  trade: string;
  bidDueDate: string;
  date: string;
  validForDays: number;
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
  questionnaireState: EstimateQuestionnaireState | null;
  preparedBy: string;
  preparedByTitle: string;
  reviewedBy: string;
  reviewedByTitle: string;
  acceptanceEnabled: boolean;
  clientDisclaimer: string;
  internalDisclaimer: string;
  internalAssumptions: string[];
  internalInferredData: string[];
  internalTechnicalBacking: string[];
  internalAnalysisNotes: string[];
  internalReviewComments: string[];
  riskRegister: string[];
  rfiRegister: string[];
  weatherNotes: string[];
  timeEstimateNotes: string[];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function parseStringArray(value: string | null | undefined) {
  return uniqueStrings(safeJsonParse<string[]>(value, []));
}

function parseStructuredNotes(value: string | null | undefined): string[] {
  const parsed = safeJsonParse<unknown>(value, null);
  if (!parsed || !Array.isArray(parsed)) return [];

  return uniqueStrings(
    parsed.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'description' in item && typeof item.description === 'string') return item.description;
      if (item && typeof item === 'object' && 'question' in item && typeof item.question === 'string') return item.question;
      return '';
    }),
  );
}

function buildLocation(project: Project) {
  return uniqueStrings([project.address, project.city, project.state, project.zip]).join(', ') || project.location || 'TBD';
}

function parsePricingSummary(value: string | null | undefined): EstimatePricingSummary {
  return safeJsonParse<EstimatePricingSummary>(value, {
    directSubtotal: 0,
    overheadPercent: 0,
    overheadAmount: 0,
    profitPercent: 0,
    profitAmount: 0,
    contingencyPercent: 0,
    contingencyAmount: 0,
    bondPercent: 0,
    bondAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    validityDays: 30,
    budgetary: false,
    proposalLabel: 'Estimate',
  });
}

function parseCostItems(value: string | null | undefined) {
  return safeJsonParse<EstimateCostItem[]>(value, []);
}

export function buildEstimateDocumentContext(source: EstimateDocumentSource): EstimateDocumentContext {
  const { project, estimate } = source;
  const pricingSummary = parsePricingSummary(estimate.pricingSummary);

  return {
    projectId: project.id,
    estimateId: estimate.id,
    estimateNumber: estimate.estimateNumber,
    estimateType: estimate.estimateType,
    title: estimate.title,
    versionLabel: estimate.versionLabel,
    status: estimate.status,
    companyName: estimate.companyName || 'Top Notch Remodeling LLC',
    companyEmail: estimate.companyEmail || '',
    companyPhone: estimate.companyPhone || '',
    companyAddress: estimate.companyAddress || '',
    projectName: project.name,
    clientName: estimate.clientRecipientName || project.client || 'TBD',
    location: buildLocation(project),
    trade: project.trade || 'General',
    bidDueDate: formatEstimateDate(project.bidDueDate),
    date: formatEstimateDate(project.updatedAt),
    validForDays: estimate.validForDays || pricingSummary.validityDays || 30,
    executiveSummary: sanitizeClientFacingText(estimate.executiveSummary) || 'Professional estimate prepared from the available bid package.',
    scopeOfWork: sanitizeClientFacingText(estimate.scopeOfWork) || 'Scope to be confirmed during review.',
    inclusions: parseStringArray(estimate.inclusions),
    exclusions: parseStringArray(estimate.exclusions),
    clarifications: parseStringArray(estimate.clarifications),
    qualifications: parseStringArray(estimate.qualifications),
    proposalNotes: parseStringArray(estimate.proposalNotes),
    keyDocuments: parseStringArray(estimate.keyDocuments),
    keyPlansAndSpecs: parseStringArray(estimate.keyPlansAndSpecs),
    costItems: parseCostItems(estimate.costItems),
    pricingSummary,
    questionnaireState: safeJsonParse<EstimateQuestionnaireState | null>(estimate.questionnaireState, null),
    preparedBy: estimate.preparedBy || 'Prepared By',
    preparedByTitle: estimate.preparedByTitle || 'Prepared By',
    reviewedBy: estimate.reviewedBy || 'Pending review',
    reviewedByTitle: estimate.reviewedByTitle || 'Reviewed By',
    acceptanceEnabled: estimate.acceptanceEnabled,
    clientDisclaimer: sanitizeClientFacingText(estimate.clientDisclaimer) || '',
    internalDisclaimer: estimate.internalDisclaimer || '',
    internalAssumptions: parseStringArray(estimate.internalAssumptions),
    internalInferredData: parseStringArray(estimate.internalInferredData),
    internalTechnicalBacking: parseStringArray(estimate.internalTechnicalBacking),
    internalAnalysisNotes: parseStringArray(estimate.internalAnalysisNotes),
    internalReviewComments: parseStringArray(estimate.internalReviewComments),
    riskRegister: parseStructuredNotes(estimate.riskRegister),
    rfiRegister: parseStructuredNotes(estimate.rfiRegister),
    weatherNotes: parseStructuredNotes(estimate.weatherNotes),
    timeEstimateNotes: parseStructuredNotes(estimate.timeEstimateNotes),
  };
}

export async function buildEstimatePdf(source: EstimateDocumentSource, documentVersion: EstimateDocumentVersion, _viewUrl?: string) {
  const context = buildEstimateDocumentContext(source);
  return exportEstimatePdf({ context, documentVersion });
}
