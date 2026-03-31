import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateQuestionnaireAnswers } from '@/lib/estimating/questionnaire/questionnaire-engine';
import type { QuestionnaireAnswerMap } from '@/lib/estimating/questionnaire/questionnaire-types';
import type { EstimateCostItem, EstimatePricingSummary } from '@/lib/estimate';
import { safeJsonParse } from '@/lib/server/json';
import { logEstimateActivity } from '@/lib/server/event-log-service';
import { decorateEstimateWithClientPreflight } from '@/lib/server/estimate-preflight-service';

const EMPTY_PRICING_SUMMARY: EstimatePricingSummary = {
  directSubtotal: 0,
  overheadPercent: 8,
  overheadAmount: 0,
  profitPercent: 5,
  profitAmount: 0,
  contingencyPercent: 3,
  contingencyAmount: 0,
  bondPercent: 0,
  bondAmount: 0,
  taxPercent: 0,
  taxAmount: 0,
  total: 0,
  validityDays: 30,
  budgetary: false,
  proposalLabel: 'Estimate',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { estimateId } = await params;
    const estimate = await db.estimate.findUnique({
      where: { id: estimateId },
      include: { project: true },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const currentCostItems = safeJsonParse<EstimateCostItem[]>(estimate.costItems, []);
    const currentPricingSummary = safeJsonParse<EstimatePricingSummary>(estimate.pricingSummary, EMPTY_PRICING_SUMMARY);
    const previousState = safeJsonParse<{
      baseCostItems?: EstimateCostItem[];
      basePricingSummary?: EstimatePricingSummary;
    } | null>(estimate.questionnaireState, null);

    const questionnaire = updateQuestionnaireAnswers({
      existingState: estimate.questionnaireState,
      trade: estimate.project.trade || estimate.title,
      estimateType: estimate.estimateType as 'trade' | 'global',
      baseCostItems: previousState?.baseCostItems || currentCostItems,
      basePricingSummary: previousState?.basePricingSummary || currentPricingSummary,
      answers: {},
    });

    return NextResponse.json(questionnaire);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load questionnaire' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { estimateId } = await params;
    const body = (await request.json().catch(() => ({}))) as { answers?: QuestionnaireAnswerMap };
    const estimate = await db.estimate.findUnique({
      where: { id: estimateId },
      include: { project: true },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const previousState = safeJsonParse<{
      baseCostItems?: EstimateCostItem[];
      basePricingSummary?: EstimatePricingSummary;
    } | null>(estimate.questionnaireState, null);
    const currentCostItems = safeJsonParse<EstimateCostItem[]>(estimate.costItems, []);
    const currentPricingSummary = safeJsonParse<EstimatePricingSummary>(estimate.pricingSummary, EMPTY_PRICING_SUMMARY);

    const questionnaire = updateQuestionnaireAnswers({
      existingState: estimate.questionnaireState,
      trade: estimate.project.trade || estimate.title,
      estimateType: estimate.estimateType as 'trade' | 'global',
      baseCostItems: Array.isArray(previousState?.baseCostItems) ? previousState.baseCostItems : currentCostItems,
      basePricingSummary: previousState?.basePricingSummary || currentPricingSummary,
      answers: body.answers || {},
    });

    const updatedEstimate = await db.estimate.update({
      where: { id: estimateId },
      data: {
        costItems: JSON.stringify(questionnaire.result.costItems),
        pricingSummary: JSON.stringify(questionnaire.result.pricingSummary),
        questionnaireTemplateId: questionnaire.template.id,
        questionnaireTrade: questionnaire.state.tradeKey,
        questionnaireState: JSON.stringify(questionnaire.state),
        status: 'Review In Progress',
        humanApprovedForClientExport: false,
        humanApprovedForSend: false,
        approvedForClientExportAt: null,
        approvedForSendAt: null,
      },
      include: {
        sends: {
          orderBy: { sentAt: 'desc' },
          include: {
            openEvents: { orderBy: { openedAt: 'desc' } },
            notificationEvents: { orderBy: { notifiedAt: 'desc' } },
          },
        },
        activity: {
          orderBy: { createdAt: 'desc' },
        },
        project: true,
      },
    });

    await logEstimateActivity({
      estimateId,
      activityType: 'status_changed',
      title: 'Questionnaire updated',
      description: 'Trade questionnaire answers were saved and the estimate was recalculated.',
      metadata: {
        status: 'Review In Progress',
        questionnaireTemplateId: questionnaire.template.id,
      },
    });

    return NextResponse.json({
      estimate: decorateEstimateWithClientPreflight(updatedEstimate, updatedEstimate.project),
      questionnaire,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save questionnaire' },
      { status: 500 },
    );
  }
}
