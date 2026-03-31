import type { Estimate, Project } from '@prisma/client';
import {
  findClientFacingLanguageIssues,
  isClientDocumentVersion,
  type EstimateCostItem,
  type EstimateDocumentVersion,
  type EstimatePricingSummary,
} from '@/lib/estimate';
import type { EstimateQuestionnaireState } from '@/lib/estimating/questionnaire/questionnaire-types';
import { safeJsonParse } from '@/lib/server/json';

export type EstimatePreflightIssueSeverity = 'blocking' | 'warning';

export interface EstimatePreflightIssue {
  code: string;
  severity: EstimatePreflightIssueSeverity;
  field: string;
  title: string;
  description: string;
}

export interface EstimatePreflightReport {
  checkedAt: string;
  contentReady: boolean;
  readyForClientExport: boolean;
  readyForSend: boolean;
  blockingIssues: EstimatePreflightIssue[];
  warnings: EstimatePreflightIssue[];
  approvals: {
    clientExportApproved: boolean;
    sendApproved: boolean;
  };
}

type EstimatePreflightSource = {
  estimate: Estimate;
  project: Project;
};

const WEAK_PLACEHOLDERS = new Set([
  '',
  'tbd',
  'estimator',
  'prepared by',
  'reviewed by',
  'pending review',
  'pending due date',
  'pending client confirmation',
  'pending gc confirmation',
  'pending client confirmation / pending gc confirmation',
  'as listed on bid invitation',
  'per bid documents',
  'per bid schedule',
]);

const CLIENT_READY_STATUSES = new Set([
  'Client Version Ready',
  'Approved for Client Export',
  'Approved for Send',
  'Sent',
  'Opened',
  'Re-opened',
]);

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function normalizeWeakPlaceholder(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function isWeakPlaceholder(value: string | null | undefined) {
  const normalized = normalizeWeakPlaceholder(value);
  if (!normalized) {
    return true;
  }

  return WEAK_PLACEHOLDERS.has(normalized) || normalized.startsWith('pending ');
}

function hasMeaningfulText(value: string | null | undefined, minimumLength = 1) {
  const normalized = normalizeText(value);
  return !isWeakPlaceholder(normalized) && normalized.length >= minimumLength;
}

function parseStringList(value: string | null | undefined) {
  return safeJsonParse<string[]>(value, [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parseCostItems(value: string | null | undefined) {
  return safeJsonParse<EstimateCostItem[]>(value, []);
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
    validityDays: 0,
    budgetary: false,
    proposalLabel: '',
  });
}

function parseQuestionnaireState(value: string | null | undefined) {
  return safeJsonParse<EstimateQuestionnaireState | null>(value, null);
}

function buildProjectLocation(project: Project) {
  const parts = [project.address, project.city, project.state, project.zip]
    .map((item) => normalizeText(item))
    .filter((item) => !isWeakPlaceholder(item));

  if (parts.length) {
    return parts.join(', ');
  }

  const fallback = normalizeText(project.location);
  return isWeakPlaceholder(fallback) ? '' : fallback;
}

function addIssue(
  collection: EstimatePreflightIssue[],
  issue: Omit<EstimatePreflightIssue, 'severity'> & { severity?: EstimatePreflightIssueSeverity },
) {
  if (collection.some((existing) => existing.code === issue.code)) {
    return;
  }

  collection.push({
    severity: issue.severity ?? 'blocking',
    ...issue,
  });
}

export class EstimateWorkflowValidationError extends Error {
  statusCode: number;
  preflight?: EstimatePreflightReport;

  constructor(message: string, options?: { statusCode?: number; preflight?: EstimatePreflightReport }) {
    super(message);
    this.name = 'EstimateWorkflowValidationError';
    this.statusCode = options?.statusCode ?? 400;
    this.preflight = options?.preflight;
  }
}

export function buildEstimatePreflightReport(source: EstimatePreflightSource): EstimatePreflightReport {
  const blockingIssues: EstimatePreflightIssue[] = [];
  const warnings: EstimatePreflightIssue[] = [];
  const estimate = source.estimate;
  const project = source.project;
  const pricingSummary = parsePricingSummary(estimate.pricingSummary);
  const costItems = parseCostItems(estimate.costItems);
  const inclusions = parseStringList(estimate.inclusions);
  const exclusions = parseStringList(estimate.exclusions);
  const clarifications = parseStringList(estimate.clarifications);
  const qualifications = parseStringList(estimate.qualifications);
  const proposalNotes = parseStringList(estimate.proposalNotes);
  const clientDisclaimer = normalizeText(estimate.clientDisclaimer);
  const projectClient = normalizeText(project.client);
  const estimateClient = normalizeText(estimate.clientRecipientName);
  const clientName = !isWeakPlaceholder(projectClient)
    ? projectClient
    : !isWeakPlaceholder(estimateClient)
      ? estimateClient
      : '';
  const location = buildProjectLocation(project);
  const trade = normalizeText(project.trade);
  const reviewedBy = normalizeText(estimate.reviewedBy);
  const preparedBy = normalizeText(estimate.preparedBy);
  const companyName = normalizeText(estimate.companyName);
  const questionnaireState = parseQuestionnaireState(estimate.questionnaireState);

  if (!hasMeaningfulText(estimate.title, 6)) {
    addIssue(blockingIssues, {
      code: 'missing_estimate_title',
      field: 'title',
      title: 'Estimate title needs refinement',
      description: 'Set a clear professional estimate title before exporting a client-facing document.',
    });
  }

  if (!hasMeaningfulText(companyName, 3)) {
    addIssue(blockingIssues, {
      code: 'missing_company_name',
      field: 'companyName',
      title: 'Company branding is incomplete',
      description: 'Add the actual company name so the proposal does not rely on a placeholder in the header or signature area.',
    });
  }

  if (!hasMeaningfulText(preparedBy, 3)) {
    addIssue(blockingIssues, {
      code: 'missing_prepared_by',
      field: 'preparedBy',
      title: 'Prepared by needs a real name',
      description: 'Set the estimator or preparer name instead of leaving a placeholder before client export.',
    });
  }

  if (!hasMeaningfulText(reviewedBy, 3)) {
    addIssue(blockingIssues, {
      code: 'missing_reviewed_by',
      field: 'reviewedBy',
      title: 'Reviewed by needs confirmation',
      description: 'Enter the human reviewer name so the estimate shows a real review chain before client delivery.',
    });
  }

  if (!clientName) {
    addIssue(blockingIssues, {
      code: 'missing_client_name',
      field: 'clientRecipientName',
      title: 'Client / GC is still unresolved',
      description: 'Set the actual client or GC name instead of relying on a generic fallback in the client PDF.',
    });
  }

  if (!location) {
    addIssue(blockingIssues, {
      code: 'missing_location',
      field: 'location',
      title: 'Project location is incomplete',
      description: 'Add the project address or location before exporting a client estimate.',
    });
  }

  if (!hasMeaningfulText(trade, 3) || (estimate.estimateType === 'trade' && normalizeWeakPlaceholder(trade) === 'general')) {
    addIssue(
      estimate.estimateType === 'trade' ? blockingIssues : warnings,
      {
        code: 'missing_trade',
        field: 'trade',
        title: 'Trade needs to be confirmed',
        description:
          estimate.estimateType === 'trade'
            ? 'Set the actual trade or discipline so the client estimate is not issued under a generic scope.'
            : 'Confirm the trade label or trade mix so the global estimate metadata is complete.',
      },
    );
  }

  if (!project.bidDueDate) {
    addIssue(blockingIssues, {
      code: 'missing_bid_due_date',
      field: 'bidDueDate',
      title: 'Bid due date is missing',
      description: 'Set the bid due date in the project details before exporting a client-facing estimate.',
    });
  }

  if (!hasMeaningfulText(estimate.executiveSummary, 40)) {
    addIssue(blockingIssues, {
      code: 'missing_executive_summary',
      field: 'executiveSummary',
      title: 'Executive summary is too thin',
      description: 'Write a complete commercial executive summary before client export.',
    });
  }

  if (!hasMeaningfulText(estimate.scopeOfWork, 40)) {
    addIssue(blockingIssues, {
      code: 'missing_scope',
      field: 'scopeOfWork',
      title: 'Scope of work needs more detail',
      description: 'Describe the covered scope clearly so the proposal does not read like a placeholder.',
    });
  }

  if (inclusions.length === 0) {
    addIssue(blockingIssues, {
      code: 'missing_inclusions',
      field: 'inclusions',
      title: 'Inclusions are empty',
      description: 'Add inclusions so the client copy clearly states what is covered in the estimate.',
    });
  }

  if (exclusions.length === 0) {
    addIssue(blockingIssues, {
      code: 'missing_exclusions',
      field: 'exclusions',
      title: 'Exclusions are empty',
      description: 'Add exclusions so the proposal has a clear commercial boundary.',
    });
  }

  if (clarifications.length === 0) {
    addIssue(blockingIssues, {
      code: 'missing_clarifications',
      field: 'clarifications',
      title: 'Clarifications are missing',
      description: 'Add clarifications covering labor basis, schedule assumptions, and site access before client export.',
    });
  }

  if (qualifications.length === 0) {
    addIssue(blockingIssues, {
      code: 'missing_qualifications',
      field: 'qualifications',
      title: 'Qualifications are missing',
      description: 'Add proposal qualifications so the client estimate has the expected commercial protections.',
    });
  }

  if (proposalNotes.length === 0) {
    addIssue(warnings, {
      code: 'missing_proposal_notes',
      severity: 'warning',
      field: 'proposalNotes',
      title: 'Proposal notes are light',
      description: 'Add proposal notes if you want stronger commercial framing in the premium client PDF.',
    });
  }

  if (!hasMeaningfulText(clientDisclaimer, 40)) {
    addIssue(blockingIssues, {
      code: 'missing_client_disclaimer',
      field: 'clientDisclaimer',
      title: 'Client disclaimer is incomplete',
      description: 'Restore or rewrite the client disclaimer so the proposal closes with a professional commercial note.',
    });
  }

  if (costItems.length === 0) {
    addIssue(blockingIssues, {
      code: 'missing_cost_items',
      field: 'costItems',
      title: 'Cost breakdown is empty',
      description: 'Add priced line items before exporting a client-facing estimate.',
    });
  }

  const invalidCostItems = costItems.filter((item) => {
    const description = normalizeText(item.description);
    const unit = normalizeText(item.unit);
    return !description || !unit || !Number.isFinite(item.quantity) || item.quantity <= 0;
  });

  if (invalidCostItems.length > 0) {
    addIssue(blockingIssues, {
      code: 'invalid_cost_items',
      field: 'costItems',
      title: 'Cost breakdown has incomplete lines',
      description: 'Every cost line needs a description, quantity above zero, and unit before the client estimate can be exported.',
    });
  }

  if (!Number.isFinite(pricingSummary.directSubtotal) || pricingSummary.directSubtotal <= 0) {
    addIssue(blockingIssues, {
      code: 'invalid_direct_subtotal',
      field: 'pricingSummary',
      title: 'Direct subtotal is not ready',
      description: 'The estimate needs a valid direct subtotal greater than zero before client delivery.',
    });
  }

  if (!Number.isFinite(pricingSummary.total) || pricingSummary.total <= 0) {
    addIssue(blockingIssues, {
      code: 'invalid_total',
      field: 'pricingSummary',
      title: 'Final total is not ready',
      description: 'The estimate total must be greater than zero before exporting or sending the client package.',
    });
  }

  if (!Number.isFinite(estimate.validForDays) || estimate.validForDays <= 0) {
    addIssue(blockingIssues, {
      code: 'invalid_validity',
      field: 'validForDays',
      title: 'Validity period is missing',
      description: 'Set a valid proposal duration in days before issuing the estimate.',
    });
  }

  if (!hasMeaningfulText(estimate.companyEmail, 5)) {
    addIssue(warnings, {
      code: 'missing_company_email',
      severity: 'warning',
      field: 'companyEmail',
      title: 'Company contact email is missing',
      description: 'Add a company email so the proposal carries a stronger contact trail in the header and send workflow.',
    });
  }

  if (!hasMeaningfulText(estimate.clientRecipientEmail, 5)) {
    addIssue(warnings, {
      code: 'missing_client_email',
      severity: 'warning',
      field: 'clientRecipientEmail',
      title: 'Recipient email is not prefilled',
      description: 'You can still type a recipient at send time, but saving the intended recipient email keeps the estimate package cleaner.',
    });
  }

  if (!CLIENT_READY_STATUSES.has(estimate.status)) {
    addIssue(warnings, {
      code: 'status_not_ready',
      severity: 'warning',
      field: 'status',
      title: 'Estimate status is still in review',
      description: 'The estimate content may be clean, but the status has not yet moved into a client-ready phase.',
    });
  }

  if (!questionnaireState) {
    addIssue(warnings, {
      code: 'missing_questionnaire_state',
      severity: 'warning',
      field: 'questionnaireState',
      title: 'Questionnaire state is missing',
      description: 'This estimate no longer has questionnaire state attached. Re-save the questionnaire if you need the full pricing basis preserved.',
    });
  }

  const clientFacingFields: Array<{ field: string; label: string; values: string[] }> = [
    { field: 'title', label: 'Estimate title', values: [estimate.title] },
    { field: 'executiveSummary', label: 'Executive summary', values: [estimate.executiveSummary || ''] },
    { field: 'scopeOfWork', label: 'Scope of work', values: [estimate.scopeOfWork || ''] },
    { field: 'inclusions', label: 'Inclusions', values: inclusions },
    { field: 'exclusions', label: 'Exclusions', values: exclusions },
    { field: 'clarifications', label: 'Clarifications', values: clarifications },
    { field: 'qualifications', label: 'Qualifications', values: qualifications },
    { field: 'proposalNotes', label: 'Proposal notes', values: proposalNotes },
    { field: 'clientDisclaimer', label: 'Client disclaimer', values: [clientDisclaimer] },
  ];

  for (const field of clientFacingFields) {
    const matches = [...new Set(field.values.flatMap((value) => findClientFacingLanguageIssues(value)))];
    if (matches.length === 0) {
      continue;
    }

    addIssue(blockingIssues, {
      code: `banned_language_${field.field}`,
      field: field.field,
      title: `${field.label} still contains internal language`,
      description: `Remove internal or AI-style wording from ${field.label.toLowerCase()}. Found: ${matches.join(', ')}.`,
    });
  }

  const contentReady = blockingIssues.length === 0;

  return {
    checkedAt: new Date().toISOString(),
    contentReady,
    readyForClientExport: contentReady && Boolean(estimate.humanApprovedForClientExport),
    readyForSend: contentReady && Boolean(estimate.humanApprovedForClientExport) && Boolean(estimate.humanApprovedForSend),
    blockingIssues,
    warnings,
    approvals: {
      clientExportApproved: Boolean(estimate.humanApprovedForClientExport),
      sendApproved: Boolean(estimate.humanApprovedForSend),
    },
  };
}

export function decorateEstimateWithClientPreflight<T extends Estimate>(
  estimate: T,
  project: Project,
): T & { clientPreflight: EstimatePreflightReport } {
  return {
    ...estimate,
    clientPreflight: buildEstimatePreflightReport({ estimate, project }),
  };
}

export function ensureEstimateCanExport(
  source: EstimatePreflightSource,
  documentVersion: EstimateDocumentVersion,
) {
  const preflight = buildEstimatePreflightReport(source);

  if (isClientDocumentVersion(documentVersion) && !preflight.contentReady) {
    throw new EstimateWorkflowValidationError(
      'Client export preflight failed. Resolve the blocking review items before exporting a client PDF.',
      { preflight },
    );
  }

  if (isClientDocumentVersion(documentVersion) && !source.estimate.humanApprovedForClientExport) {
    throw new EstimateWorkflowValidationError(
      'This estimate must be manually approved for client export before exporting a client PDF.',
      { preflight },
    );
  }

  return preflight;
}

export function ensureEstimateCanSend(
  source: EstimatePreflightSource,
  documentVersion: EstimateDocumentVersion,
) {
  const preflight = buildEstimatePreflightReport(source);

  if (isClientDocumentVersion(documentVersion) && !preflight.contentReady) {
    throw new EstimateWorkflowValidationError(
      'Client send preflight failed. Resolve the blocking review items before sending this estimate.',
      { preflight },
    );
  }

  if (isClientDocumentVersion(documentVersion) && !source.estimate.humanApprovedForClientExport) {
    throw new EstimateWorkflowValidationError(
      'This estimate must be manually approved for client export before sending.',
      { preflight },
    );
  }

  if (!source.estimate.humanApprovedForSend) {
    throw new EstimateWorkflowValidationError(
      'This estimate must be manually approved for send before delivery.',
      { preflight },
    );
  }

  return preflight;
}
