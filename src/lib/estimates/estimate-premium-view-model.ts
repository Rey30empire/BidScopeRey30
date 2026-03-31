import type { EstimateDocumentVersion } from '@/lib/estimate';
import { getDocumentVersionLabel, isClientDocumentVersion, toCurrency } from '@/lib/estimate';
import type { EstimateDocumentContext } from '@/lib/server/estimate-document-service';
import type {
  EstimateCostBreakdownRow,
  EstimatePremiumRenderModel,
  EstimateSelectionBlock,
  EstimateSummaryRow,
  PremiumBrandingModel,
} from '@/lib/estimates/estimate-render-model';

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isWeakPlaceholder(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized === 'tbd' ||
    normalized === 'estimator' ||
    normalized === 'pending review' ||
    normalized === 'prepared by' ||
    normalized === 'reviewed by' ||
    normalized === 'pending due date' ||
    normalized === 'pending client confirmation' ||
    normalized === 'pending gc confirmation' ||
    normalized === 'pending client confirmation / pending gc confirmation'
  );
}

function displayValue(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized && !isWeakPlaceholder(normalized) ? normalized : fallback;
}

function displayValueOrBlank(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized && !isWeakPlaceholder(normalized) ? normalized : '';
}

function buildMaterialSelectionBlocks(context: EstimateDocumentContext): EstimateSelectionBlock[] {
  if (context.questionnaireState?.presentation.selectionBlocks.length) {
    return context.questionnaireState.presentation.selectionBlocks;
  }

  const blocks = context.costItems.map((item, index) => ({
    title: item.section || `Scope Package ${index + 1}`,
    prompt:
      index === 0
        ? `Primary carried scope for the ${context.trade.toLowerCase()} estimate`
        : `Pricing basis for ${item.section?.toLowerCase() || 'this scope package'}`,
    answer: normalizeText(item.description),
    supportingText: item.notes || `${item.quantity} ${item.unit} carried in the estimate.`,
    amountLabel: toCurrency(item.subtotal || item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost),
    options: [
      { label: `Qty ${item.quantity}`, description: item.unit, active: true },
      { label: `Material ${toCurrency(item.materialCost)}`, active: item.materialCost > 0 },
      { label: `Labor ${toCurrency(item.laborCost)}`, active: item.laborCost > 0 },
      { label: `Equipment ${toCurrency(item.equipmentCost)}`, active: item.equipmentCost > 0 },
    ],
  }));

  if (blocks.length) {
    return blocks;
  }

  return [
    {
      title: 'Pricing Basis',
      prompt: `Primary basis carried for the ${context.trade.toLowerCase()} scope`,
      answer: normalizeText(context.scopeOfWork || context.executiveSummary),
      supportingText: 'Current pricing basis and commercial selections are reflected in the estimate summary below.',
      amountLabel: toCurrency(context.pricingSummary.total),
      options: [
        { label: context.pricingSummary.proposalLabel, active: true },
        { label: `${context.validForDays} day validity` },
      ],
    },
  ];
}

function buildPricingFields(context: EstimateDocumentContext) {
  if (context.questionnaireState?.presentation.pricingFields.length) {
    return context.questionnaireState.presentation.pricingFields;
  }

  return [
    { label: 'Pricing method', value: context.pricingSummary.proposalLabel },
    { label: 'Direct subtotal', value: toCurrency(context.pricingSummary.directSubtotal) },
    { label: 'Overhead / markup', value: `${context.pricingSummary.overheadPercent}%` },
    { label: 'Profit', value: `${context.pricingSummary.profitPercent}%` },
    { label: 'Contingency', value: `${context.pricingSummary.contingencyPercent}%` },
    { label: 'Tax', value: `${context.pricingSummary.taxPercent}%` },
  ];
}

function buildCostRows(context: EstimateDocumentContext): EstimateCostBreakdownRow[] {
  return context.costItems.map((item) => ({
    item: item.section || 'Scope',
    description: normalizeText(item.description),
    quantity: `${item.quantity}`,
    unit: item.unit,
    material: toCurrency(item.materialCost),
    labor: toCurrency(item.laborCost),
    equipment: toCurrency(item.equipmentCost + item.subcontractCost),
    subtotal: toCurrency(item.subtotal || item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost),
  }));
}

function buildSummaryRows(context: EstimateDocumentContext): EstimateSummaryRow[] {
  return [
    { label: 'Direct Subtotal', value: toCurrency(context.pricingSummary.directSubtotal) },
    {
      label: `Overhead / Markup (${context.pricingSummary.overheadPercent}%)`,
      value: toCurrency(context.pricingSummary.overheadAmount),
    },
    { label: `Profit (${context.pricingSummary.profitPercent}%)`, value: toCurrency(context.pricingSummary.profitAmount) },
    {
      label: `Contingency (${context.pricingSummary.contingencyPercent}%)`,
      value: toCurrency(context.pricingSummary.contingencyAmount),
    },
    { label: `Tax (${context.pricingSummary.taxPercent}%)`, value: toCurrency(context.pricingSummary.taxAmount) },
    { label: 'Final Total', value: toCurrency(context.pricingSummary.total), emphasize: true },
  ];
}

export function buildEstimatePremiumViewModel(input: {
  branding: PremiumBrandingModel;
  context: EstimateDocumentContext;
  documentVersion: EstimateDocumentVersion;
}): EstimatePremiumRenderModel {
  const { branding, context, documentVersion } = input;
  const isInternal = documentVersion === 'internal_review';
  const isClient = isClientDocumentVersion(documentVersion);
  const isGlobal = context.estimateType === 'global';
  const title = isGlobal ? 'Budgetary Estimate' : 'Professional Estimate';
  const statusLabel =
    context.status === 'Approved for Send' || context.status === 'Approved for Client Export'
      ? 'Needs Human Review'
      : context.status;
  const clientName = isClient ? displayValue(context.clientName, 'As listed on bid invitation') : displayValue(context.clientName, 'TBD');
  const location = isClient ? displayValue(context.location, 'Per bid documents') : displayValue(context.location, 'TBD');
  const trade = isClient ? displayValue(context.trade, 'General Scope') : displayValue(context.trade, 'General');
  const bidDueDate = isClient ? displayValueOrBlank(context.bidDueDate) || 'Per bid schedule' : displayValue(context.bidDueDate, 'TBD');
  const estimatorName = isClient
    ? displayValue(context.preparedBy, branding.companyName)
    : displayValue(context.preparedBy, context.companyName);
  const signatureName = isClient
    ? displayValueOrBlank(context.reviewedBy) || displayValueOrBlank(context.preparedBy) || branding.signatureTextFallback || branding.companyName
    : displayValueOrBlank(context.reviewedBy) || displayValueOrBlank(context.preparedBy) || branding.signatureTextFallback;

  const clarifications = context.clarifications.length
    ? context.clarifications
    : ['Pricing is based on standard working hours, normal access, and the bid package available at time of preparation.'];
  const qualifications = context.qualifications.length
    ? context.qualifications
    : ['Final contract value remains subject to review, field verification, and executed contract terms.'];
  const proposalNotes = context.proposalNotes.length
    ? context.proposalNotes
    : isGlobal
      ? ['Budgetary estimate prepared for planning alignment and preliminary commercial review based on the available bid package.']
      : ['Pricing reflects the reviewed bid package, selected commercial basis, and proposal assumptions carried in this estimate.'];
  const questionnairePresentation = context.questionnaireState?.presentation ?? null;

  const internalSections = isInternal
    ? [
        { title: 'Internal Assumptions', items: context.internalAssumptions },
        { title: 'Technical Backing', items: context.internalTechnicalBacking },
        { title: 'Review Comments', items: context.internalReviewComments },
        { title: 'RFIs', items: context.rfiRegister },
      ].filter((section) => section.items.length)
    : [];

  return {
    branding,
    estimateTitle: title,
    estimateSubtitle: getDocumentVersionLabel(documentVersion),
    statusLabel,
    executiveSummary: context.executiveSummary,
    scopeOfWork: context.scopeOfWork,
    inclusions: context.inclusions,
    exclusions: context.exclusions,
    metaFields: [
      { label: 'Estimate #', value: context.estimateNumber },
      { label: 'Date', value: context.date },
      { label: 'Version', value: context.versionLabel },
      { label: 'Valid for', value: `${context.validForDays} days` },
    ],
    infoLeft: [
      { label: 'Project', value: context.projectName },
      { label: 'Client / GC', value: clientName },
      { label: 'Location', value: location },
      { label: 'Trade', value: trade },
      { label: 'Estimator', value: estimatorName },
      { label: 'Bid due date', value: bidDueDate },
    ],
    infoRight: [
      { label: 'Estimate #', value: context.estimateNumber },
      { label: 'Date', value: context.date },
      { label: 'Version', value: context.versionLabel },
      { label: 'Valid for', value: `${context.validForDays} days` },
    ],
    preliminaryNote:
      isGlobal
        ? 'This is a preliminary budgetary estimate intended for planning, alignment, and early commercial review.'
        : 'This estimate is prepared from the reviewed bid package and remains subject to final review, clarifications, and field verification.',
    materialSectionTitle: questionnairePresentation?.sectionTitle || 'Material Selection Questions',
    materialSelectionBlocks: buildMaterialSelectionBlocks(context),
    pricingFields: buildPricingFields(context),
    costBreakdownNotes: questionnairePresentation?.notes.length ? questionnairePresentation.notes : proposalNotes,
    costRows: buildCostRows(context),
    summaryRows: buildSummaryRows(context),
    finalTotal: toCurrency(context.pricingSummary.total),
    clarifications,
    qualifications,
    proposalNotes,
    internalSections,
    signatureLabel: 'Prepared by',
    signatureName,
    signatureNote: isInternal ? 'Internal review copy' : 'Client proposal copy',
    footerGeneratedByText: branding.footerGeneratedByText,
    footerLegalText: branding.footerLegalText,
  };
}
