import type { Estimate, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  DEFAULT_GLOBAL_TEMPLATE,
  DEFAULT_TRADE_TEMPLATE,
  sanitizeClientFacingText,
  type EstimateCostItem,
  type EstimateDraftPayload,
  type EstimatePricingSummary,
  type EstimateType,
} from '@/lib/estimate';
import { buildQuestionnaireState } from '@/lib/estimating/questionnaire/questionnaire-engine';
import { safeJsonParse } from '@/lib/server/json';
import { buildProjectReport } from '@/lib/server/report';
import { generateJson } from '@/lib/server/openai';
import { buildEstimateDraftsPrompt } from '@/lib/server/estimate-prompts';
import { logEstimateActivity } from '@/lib/server/event-log-service';

type ProjectWithAnalysis = Prisma.ProjectGetPayload<{
  include: {
    files: true;
    analysis: true;
    estimates: {
      include: {
        sends: {
          include: {
            openEvents: true;
            notificationEvents: true;
          };
        };
        activity: true;
      };
    };
  };
}>;

type EstimateDraftBundle = {
  trade: EstimateDraftPayload;
  global: EstimateDraftPayload;
};

function buildEstimateNumber(projectId: string, createdAt: Date, type: EstimateType) {
  const dateCode = createdAt
    .toISOString()
    .slice(2, 10)
    .replaceAll('-', '');
  const suffix = type === 'global' ? 'G' : 'T';
  return `BSR-${dateCode}-${projectId.slice(-4).toUpperCase()}-${suffix}`;
}

function roundMoney(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

function sumCostItems(items: EstimateCostItem[]) {
  return roundMoney(
    items.reduce((total, item) => {
      return total + (item.subtotal || item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost);
    }, 0),
  );
}

function finalizePricingSummary(
  items: EstimateCostItem[],
  partial: Partial<EstimatePricingSummary> | null | undefined,
  type: EstimateType,
): EstimatePricingSummary {
  const directSubtotal = sumCostItems(items);
  const overheadPercent = partial?.overheadPercent ?? 8;
  const profitPercent = partial?.profitPercent ?? 5;
  const contingencyPercent = partial?.contingencyPercent ?? (type === 'global' ? 5 : 3);
  const bondPercent = partial?.bondPercent ?? 0;
  const taxPercent = partial?.taxPercent ?? 0;
  const overheadAmount = roundMoney((directSubtotal * overheadPercent) / 100);
  const profitAmount = roundMoney((directSubtotal * profitPercent) / 100);
  const contingencyAmount = roundMoney((directSubtotal * contingencyPercent) / 100);
  const bondAmount = roundMoney((directSubtotal * bondPercent) / 100);
  const taxableBase = directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount;
  const taxAmount = roundMoney((taxableBase * taxPercent) / 100);
  const total = roundMoney(
    partial?.total ?? directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount + taxAmount,
  );

  return {
    directSubtotal,
    overheadPercent,
    overheadAmount,
    profitPercent,
    profitAmount,
    contingencyPercent,
    contingencyAmount,
    bondPercent,
    bondAmount,
    taxPercent,
    taxAmount,
    total,
    validityDays: partial?.validityDays ?? 30,
    budgetary: partial?.budgetary ?? type === 'global',
    proposalLabel: partial?.proposalLabel ?? (type === 'global' ? 'Budgetary Estimate' : 'Trade Estimate'),
  };
}

function normalizeCostItems(value: unknown): EstimateCostItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map<EstimateCostItem | null>((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const description = typeof record.description === 'string' ? record.description.trim() : '';
      if (!description) {
        return null;
      }

      const quantity = typeof record.quantity === 'number' ? record.quantity : 1;
      const materialCost = typeof record.materialCost === 'number' ? record.materialCost : 0;
      const laborCost = typeof record.laborCost === 'number' ? record.laborCost : 0;
      const equipmentCost = typeof record.equipmentCost === 'number' ? record.equipmentCost : 0;
      const subcontractCost = typeof record.subcontractCost === 'number' ? record.subcontractCost : 0;
      const subtotal = typeof record.subtotal === 'number'
        ? record.subtotal
        : materialCost + laborCost + equipmentCost + subcontractCost;

      return {
        id: typeof record.id === 'string' ? record.id : `item-${index + 1}`,
        section: typeof record.section === 'string' ? record.section : undefined,
        description,
        quantity,
        unit: typeof record.unit === 'string' ? record.unit : 'LS',
        materialCost: roundMoney(materialCost),
        laborCost: roundMoney(laborCost),
        equipmentCost: roundMoney(equipmentCost),
        subcontractCost: roundMoney(subcontractCost),
        subtotal: roundMoney(subtotal),
        notes: typeof record.notes === 'string' ? record.notes : undefined,
      };
    })
    .filter((item): item is EstimateCostItem => Boolean(item));

  return normalized;
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean))];
}

function buildFallbackCostItems(project: ProjectWithAnalysis, type: EstimateType): EstimateCostItem[] {
  const analysis = project.analysis;
  const materials = safeJsonParse<Array<{ name?: string }>>(analysis?.materials, []);
  const timeEstimate = safeJsonParse<{ totalHours?: number; crewSize?: number }>(analysis?.timeEstimate, {});
  const totalHours = timeEstimate.totalHours ?? (type === 'global' ? 240 : 120);
  const laborRate = type === 'global' ? 92 : 88;
  const laborCost = roundMoney(totalHours * laborRate);
  const materialFactor = type === 'global' ? 85000 : 42000;
  const materialCost = materialFactor + materials.length * 3200;

  if (type === 'global') {
    const structural = roundMoney(materialCost * 0.22);
    const architectural = roundMoney(materialCost * 0.31);
    const interiors = roundMoney(materialCost * 0.17);
    const mep = roundMoney(materialCost * 0.18);
    const generalConditions = roundMoney(materialCost * 0.12);
    return [
      {
        id: 'global-1',
        section: 'General Conditions',
        description: 'General conditions, project supervision, startup coordination, and closeout.',
        quantity: 1,
        unit: 'LS',
        materialCost: 0,
        laborCost: roundMoney(laborCost * 0.2),
        equipmentCost: 0,
        subcontractCost: generalConditions,
        subtotal: roundMoney(laborCost * 0.2 + generalConditions),
      },
      {
        id: 'global-2',
        section: 'Structural / Envelope',
        description: 'Structural and building envelope budget allowance based on current bid package scope.',
        quantity: 1,
        unit: 'LS',
        materialCost: structural,
        laborCost: roundMoney(laborCost * 0.18),
        equipmentCost: 0,
        subcontractCost: 0,
        subtotal: roundMoney(structural + laborCost * 0.18),
      },
      {
        id: 'global-3',
        section: 'Architectural',
        description: 'Architectural scope, finishes, specialties, and related coordination allowance.',
        quantity: 1,
        unit: 'LS',
        materialCost: architectural,
        laborCost: roundMoney(laborCost * 0.22),
        equipmentCost: 0,
        subcontractCost: 0,
        subtotal: roundMoney(architectural + laborCost * 0.22),
      },
      {
        id: 'global-4',
        section: 'MEP',
        description: 'Mechanical, electrical, and plumbing budget allowance for the current package level.',
        quantity: 1,
        unit: 'LS',
        materialCost: mep,
        laborCost: roundMoney(laborCost * 0.2),
        equipmentCost: roundMoney(laborCost * 0.06),
        subcontractCost: 0,
        subtotal: roundMoney(mep + laborCost * 0.26),
      },
      {
        id: 'global-5',
        section: 'Interiors / Closeout',
        description: 'Interior completion, punch support, cleaning, and turnover allowance.',
        quantity: 1,
        unit: 'LS',
        materialCost: interiors,
        laborCost: roundMoney(laborCost * 0.14),
        equipmentCost: 0,
        subcontractCost: 0,
        subtotal: roundMoney(interiors + laborCost * 0.14),
      },
    ];
  }

  const baseQty = Math.max(materials.length, 4);
  return [
    {
      id: 'trade-1',
      section: 'Procurement',
      description: `${project.trade || project.analysis?.trade || 'Trade'} procurement and material buyout.`,
      quantity: 1,
      unit: 'LS',
      materialCost: roundMoney(materialCost * 0.45),
      laborCost: roundMoney(laborCost * 0.08),
      equipmentCost: 0,
      subcontractCost: 0,
      subtotal: roundMoney(materialCost * 0.45 + laborCost * 0.08),
    },
    {
      id: 'trade-2',
      section: 'Installation',
      description: `${project.trade || project.analysis?.trade || 'Trade'} field installation based on reviewed scope.`,
      quantity: baseQty,
      unit: 'EA',
      materialCost: roundMoney(materialCost * 0.35),
      laborCost: roundMoney(laborCost * 0.62),
      equipmentCost: roundMoney(laborCost * 0.05),
      subcontractCost: 0,
      subtotal: roundMoney(materialCost * 0.35 + laborCost * 0.67),
    },
    {
      id: 'trade-3',
      section: 'Project Closeout',
      description: 'Protection, punch, closeout, and coordination allowance.',
      quantity: 1,
      unit: 'LS',
      materialCost: roundMoney(materialCost * 0.08),
      laborCost: roundMoney(laborCost * 0.18),
      equipmentCost: 0,
      subcontractCost: 0,
      subtotal: roundMoney(materialCost * 0.08 + laborCost * 0.18),
    },
  ];
}

function normalizeDraft(type: EstimateType, draft: Partial<EstimateDraftPayload> | null | undefined, project: ProjectWithAnalysis): EstimateDraftPayload {
  const template = type === 'global' ? DEFAULT_GLOBAL_TEMPLATE : DEFAULT_TRADE_TEMPLATE;
  const fallbackItems = buildFallbackCostItems(project, type);
  const normalizedCostItems = normalizeCostItems(draft?.costItems);
  const costItems = normalizedCostItems.length ? normalizedCostItems : fallbackItems;
  const pricingSummary = finalizePricingSummary(costItems, draft?.pricingSummary, type);
  const report = buildProjectReport(project);

  return {
    title: sanitizeClientFacingText(draft?.title) || (type === 'global' ? 'Preliminary Global Analysis' : `${report.trade} Estimate`),
    executiveSummary:
      sanitizeClientFacingText(draft?.executiveSummary) ||
      sanitizeClientFacingText(report.probableScope) ||
      `This estimate covers the ${report.trade} scope based on reviewed drawings, specifications, and bid documents available at the time of preparation.`,
    scopeOfWork: sanitizeClientFacingText(draft?.scopeOfWork) || sanitizeClientFacingText(report.probableScope),
    inclusions: cleanStringList(draft?.inclusions).length ? cleanStringList(draft?.inclusions) : report.inclusions,
    exclusions: cleanStringList(draft?.exclusions).length ? cleanStringList(draft?.exclusions) : report.exclusions,
    clarifications: cleanStringList(draft?.clarifications).length ? cleanStringList(draft?.clarifications) : template.clarifications,
    qualifications: cleanStringList(draft?.qualifications).length ? cleanStringList(draft?.qualifications) : template.qualifications,
    proposalNotes: cleanStringList(draft?.proposalNotes).length ? cleanStringList(draft?.proposalNotes) : template.proposalNotes,
    keyDocuments: cleanStringList(draft?.keyDocuments).length ? cleanStringList(draft?.keyDocuments) : report.keyDocuments,
    keyPlansAndSpecs: cleanStringList(draft?.keyPlansAndSpecs),
    costItems,
    pricingSummary,
    internalAssumptions: cleanStringList(draft?.internalAssumptions),
    internalInferredData: cleanStringList(draft?.internalInferredData),
    internalTechnicalBacking: cleanStringList(draft?.internalTechnicalBacking),
    internalAnalysisNotes: cleanStringList(draft?.internalAnalysisNotes),
    internalReviewComments: cleanStringList(draft?.internalReviewComments),
    clientDisclaimer: sanitizeClientFacingText(draft?.clientDisclaimer) || template.clientDisclaimer,
    internalDisclaimer: draft?.internalDisclaimer?.trim() || template.internalDisclaimer,
  };
}

async function generateEstimateDrafts(project: ProjectWithAnalysis): Promise<EstimateDraftBundle> {
  const report = buildProjectReport(project);
  const analysis = project.analysis;
  const risks = report.risks.map((risk) => risk.description);
  const rfis = report.rfis.map((rfi) => rfi.question);
  const materials = report.materials.map((material) => [material.name, material.notes].filter(Boolean).join(' - '));
  const proposalReqs = safeJsonParse<string[]>(analysis?.proposalReqs, []);
  const scheduleConstraints = safeJsonParse<string[]>(analysis?.scheduleConstraints, []);
  const timeEstimate = safeJsonParse<Record<string, unknown> | null>(analysis?.timeEstimate, null);
  const weatherImpact = safeJsonParse<Record<string, unknown> | null>(analysis?.weatherImpact, null);

  const prompt = buildEstimateDraftsPrompt({
    projectName: report.projectName,
    client: report.client,
    location: report.location,
    trade: report.trade,
    bidDueDate: report.bidDueDate,
    probableScope: report.probableScope,
    keyDocuments: report.keyDocuments,
    keySpecs: report.keySpecs,
    inclusions: report.inclusions,
    exclusions: report.exclusions,
    risks,
    rfis,
    materials,
    timeEstimate: JSON.stringify(timeEstimate ?? {}, null, 2),
    weatherImpact: JSON.stringify(weatherImpact ?? {}, null, 2),
    proposalReqs,
    scheduleConstraints,
  });

  try {
    const generated = await generateJson<EstimateDraftBundle>({
      prompt,
      label: `estimate-drafts:${project.id}`,
      timeoutMs: 120000,
    });

    return {
      trade: normalizeDraft('trade', generated.trade, project),
      global: normalizeDraft('global', generated.global, project),
    };
  } catch {
    return {
      trade: normalizeDraft('trade', null, project),
      global: normalizeDraft('global', null, project),
    };
  }
}

function getDefaultCompanyName() {
  return process.env.ESTIMATE_COMPANY_NAME?.trim() || 'Top Notch Remodeling LLC';
}

function getDefaultCompanyEmail() {
  const match = process.env.EMAIL_FROM?.match(/<([^>]+)>/);
  return match?.[1] || process.env.EMAIL_FROM?.trim() || process.env.ESTIMATE_TEST_EMAIL?.trim() || null;
}

function getDefaultPreparedBy() {
  return process.env.ESTIMATE_PREPARED_BY?.trim() || 'Estimator';
}

function getDefaultReviewedBy() {
  return process.env.ESTIMATE_REVIEWED_BY?.trim() || 'Pending review';
}

function toEstimateCreateInput(
  project: ProjectWithAnalysis,
  type: EstimateType,
  draft: EstimateDraftPayload,
): Prisma.EstimateUncheckedCreateInput {
  const questionnaire = buildQuestionnaireState({
    trade: project.trade || project.analysis?.trade || draft.title,
    estimateType: type,
    baseCostItems: draft.costItems,
    basePricingSummary: draft.pricingSummary,
  });

  return {
    projectId: project.id,
    estimateType: type,
    estimateNumber: buildEstimateNumber(project.id, project.createdAt, type),
    title: draft.title,
    versionLabel: 'V1',
    status: 'Needs Human Review',
    preparedBy: getDefaultPreparedBy(),
    preparedByTitle: 'Prepared By',
    reviewedBy: getDefaultReviewedBy(),
    reviewedByTitle: 'Reviewed By',
    companyName: getDefaultCompanyName(),
    companyEmail: getDefaultCompanyEmail(),
    companyPhone: process.env.ESTIMATE_COMPANY_PHONE?.trim() || null,
    companyAddress: process.env.ESTIMATE_COMPANY_ADDRESS?.trim() || null,
    clientRecipientName: project.client || project.analysis?.client || null,
    clientRecipientEmail: project.analysis?.email || null,
    validForDays: draft.pricingSummary.validityDays,
    currency: 'USD',
    executiveSummary: draft.executiveSummary,
    scopeOfWork: draft.scopeOfWork,
    inclusions: JSON.stringify(draft.inclusions),
    exclusions: JSON.stringify(draft.exclusions),
    clarifications: JSON.stringify(draft.clarifications),
    qualifications: JSON.stringify(draft.qualifications),
    proposalNotes: JSON.stringify(draft.proposalNotes),
    keyDocuments: JSON.stringify(draft.keyDocuments),
    keyPlansAndSpecs: JSON.stringify(draft.keyPlansAndSpecs),
    costItems: JSON.stringify(questionnaire.result.costItems),
    pricingSummary: JSON.stringify(questionnaire.result.pricingSummary),
    questionnaireTemplateId: questionnaire.template.id,
    questionnaireTrade: questionnaire.state.tradeKey,
    questionnaireState: JSON.stringify(questionnaire.state),
    internalAssumptions: JSON.stringify(draft.internalAssumptions),
    internalInferredData: JSON.stringify(draft.internalInferredData),
    internalTechnicalBacking: JSON.stringify(draft.internalTechnicalBacking),
    internalAnalysisNotes: JSON.stringify(draft.internalAnalysisNotes),
    internalReviewComments: JSON.stringify(draft.internalReviewComments),
    riskRegister: JSON.stringify(project.analysis ? safeJsonParse<string[]>(project.analysis.riskItems, []) : []),
    rfiRegister: JSON.stringify(project.analysis ? safeJsonParse<string[]>(project.analysis.rfiSuggestions, []) : []),
    weatherNotes: project.analysis?.weatherImpact || null,
    timeEstimateNotes: project.analysis?.timeEstimate || null,
    clientDisclaimer: draft.clientDisclaimer,
    internalDisclaimer: draft.internalDisclaimer,
  };
}

export async function getProjectWithEstimates(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      files: true,
      analysis: true,
      estimates: {
        orderBy: { estimateType: 'asc' },
        include: {
          sends: {
            orderBy: { sentAt: 'desc' },
            include: {
              openEvents: {
                orderBy: { openedAt: 'desc' },
              },
              notificationEvents: {
                orderBy: { notifiedAt: 'desc' },
              },
            },
          },
          activity: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });
}

export async function ensureProjectEstimates(projectId: string) {
  const project = await getProjectWithEstimates(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  if (!project.analysis) {
    throw new Error('Run the analysis before generating estimates.');
  }

  const hasTrade = project.estimates.some((estimate) => estimate.estimateType === 'trade');
  const hasGlobal = project.estimates.some((estimate) => estimate.estimateType === 'global');

  if (hasTrade && hasGlobal) {
    return project;
  }

  const drafts = await generateEstimateDrafts(project);
  const missingCreates: Prisma.EstimateUncheckedCreateInput[] = [];

  if (!hasTrade) {
    missingCreates.push(toEstimateCreateInput(project, 'trade', drafts.trade));
  }
  if (!hasGlobal) {
    missingCreates.push(toEstimateCreateInput(project, 'global', drafts.global));
  }

  if (missingCreates.length) {
    await db.$transaction(
      missingCreates.map((input) => db.estimate.create({ data: input })),
    );

    for (const input of missingCreates) {
      const created = await db.estimate.findFirst({
        where: {
          projectId: input.projectId,
          estimateType: input.estimateType,
        },
      });
      if (created) {
        await logEstimateActivity({
          estimateId: created.id,
          activityType: 'status_changed',
          title: 'Estimate created',
          description: 'AI processed estimate draft generated and queued for human review.',
          metadata: {
            status: created.status,
            estimateType: created.estimateType,
          },
        });
      }
    }
  }

  return getProjectWithEstimates(projectId);
}

export async function regenerateEstimateDraft(projectId: string, estimateType?: EstimateType) {
  const project = await getProjectWithEstimates(projectId);
  if (!project || !project.analysis) {
    throw new Error('Project with analysis not found.');
  }

  const drafts = await generateEstimateDrafts(project);
  const typesToUpdate = estimateType ? [estimateType] : (['trade', 'global'] as EstimateType[]);

  for (const type of typesToUpdate) {
    const draft = type === 'global' ? drafts.global : drafts.trade;
    const data = toEstimateCreateInput(project, type, draft);
    const estimate = project.estimates.find((item) => item.estimateType === type);

    if (estimate) {
      const preservedQuestionnaire = buildQuestionnaireState({
        trade: project.trade || project.analysis?.trade || draft.title,
        estimateType: type,
        baseCostItems: draft.costItems,
        basePricingSummary: draft.pricingSummary,
        existingState: estimate.questionnaireState,
      });

      await db.estimate.update({
        where: { id: estimate.id },
        data: {
          title: data.title,
          status: 'Needs Human Review',
          executiveSummary: data.executiveSummary,
          scopeOfWork: data.scopeOfWork,
          inclusions: data.inclusions,
          exclusions: data.exclusions,
          clarifications: data.clarifications,
          qualifications: data.qualifications,
          proposalNotes: data.proposalNotes,
          keyDocuments: data.keyDocuments,
          keyPlansAndSpecs: data.keyPlansAndSpecs,
          costItems: JSON.stringify(preservedQuestionnaire.result.costItems),
          pricingSummary: JSON.stringify(preservedQuestionnaire.result.pricingSummary),
          questionnaireTemplateId: preservedQuestionnaire.template.id,
          questionnaireTrade: preservedQuestionnaire.state.tradeKey,
          questionnaireState: JSON.stringify(preservedQuestionnaire.state),
          internalAssumptions: data.internalAssumptions,
          internalInferredData: data.internalInferredData,
          internalTechnicalBacking: data.internalTechnicalBacking,
          internalAnalysisNotes: data.internalAnalysisNotes,
          internalReviewComments: data.internalReviewComments,
          clientDisclaimer: data.clientDisclaimer,
          internalDisclaimer: data.internalDisclaimer,
          humanApprovedForClientExport: false,
          humanApprovedForSend: false,
          approvedForClientExportAt: null,
          approvedForSendAt: null,
        },
      });

      await logEstimateActivity({
        estimateId: estimate.id,
        activityType: 'status_changed',
        title: 'Estimate regenerated',
        description: 'Estimate draft regenerated from the latest project analysis and reset to human review.',
        metadata: { status: 'Needs Human Review', estimateType: type },
      });
    }
  }

  return getProjectWithEstimates(projectId);
}

export async function updateEstimateStatus(estimateId: string, status: string) {
  const estimate = await db.estimate.update({
    where: { id: estimateId },
    data: { status },
  });

  await logEstimateActivity({
    estimateId,
    activityType: 'status_changed',
    title: 'Estimate status updated',
    description: `Status changed to ${status}.`,
    metadata: { status },
  });

  return estimate;
}

export function isClientExportApproved(estimate: Pick<Estimate, 'humanApprovedForClientExport'>) {
  return Boolean(estimate.humanApprovedForClientExport);
}

export function isSendApproved(estimate: Pick<Estimate, 'humanApprovedForSend'>) {
  return Boolean(estimate.humanApprovedForSend);
}
