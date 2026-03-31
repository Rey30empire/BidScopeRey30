import { type EstimateCostItem, type EstimatePricingSummary, type EstimateType } from '@/lib/estimate';
import {
  buildQuestionnairePresentation,
  mapQuestionnaireAnswersToPricingProfile,
} from '@/lib/estimating/questionnaire/estimate-answer-mapper';
import type {
  EstimateQuestionnaireState,
  QuestionnaireComputationResult,
} from '@/lib/estimating/questionnaire/questionnaire-types';

function roundMoney(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

function recalculateSummary(
  estimateType: EstimateType,
  items: EstimateCostItem[],
  baseSummary: EstimatePricingSummary,
  contingencyPercent: number,
  taxPercent: number,
): EstimatePricingSummary {
  const directSubtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
  const overheadAmount = roundMoney((directSubtotal * (baseSummary.overheadPercent || 0)) / 100);
  const profitAmount = roundMoney((directSubtotal * (baseSummary.profitPercent || 0)) / 100);
  const contingencyAmount = roundMoney((directSubtotal * contingencyPercent) / 100);
  const bondAmount = roundMoney((directSubtotal * (baseSummary.bondPercent || 0)) / 100);
  const taxBase = directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount;
  const taxAmount = roundMoney((taxBase * taxPercent) / 100);
  const total = roundMoney(directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount + taxAmount);

  return {
    ...baseSummary,
    budgetary: estimateType === 'global',
    directSubtotal,
    overheadAmount,
    profitAmount,
    contingencyPercent,
    contingencyAmount,
    taxPercent,
    taxAmount,
    bondAmount,
    total,
  };
}

export function applyEstimateQuestionnairePricing(state: EstimateQuestionnaireState): QuestionnaireComputationResult {
  const profile = mapQuestionnaireAnswersToPricingProfile({ state });
  const costItems = state.baseCostItems.map((item) => {
    const materialCost = roundMoney(item.materialCost * profile.materialMultiplier);
    const laborCost = roundMoney(item.laborCost * profile.laborMultiplier);
    const equipmentCost = roundMoney(item.equipmentCost * profile.equipmentMultiplier);
    const subcontractCost = roundMoney(item.subcontractCost);
    const quantity = roundMoney(item.quantity * profile.quantityMultiplier);
    const subtotal = roundMoney(materialCost + laborCost + equipmentCost + subcontractCost);

    return {
      ...item,
      quantity,
      materialCost,
      laborCost,
      equipmentCost,
      subcontractCost,
      subtotal,
      notes: [item.notes, `Questionnaire basis applied: ${profile.materialUnitLabel}, ${profile.laborModelLabel}.`]
        .filter(Boolean)
        .join(' '),
    };
  });

  const mergedCostItems = [...costItems, ...profile.extraItems].map((item, index) => ({
    ...item,
    id: item.id || `questionnaire-item-${index + 1}`,
    subtotal: roundMoney(item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost),
  }));

  const pricingSummary = recalculateSummary(
    state.estimateType,
    mergedCostItems,
    state.basePricingSummary,
    profile.contingencyPercent,
    profile.taxPercent,
  );

  return {
    costItems: mergedCostItems,
    pricingSummary,
    presentation: buildQuestionnairePresentation({
      state,
      resultCostItems: mergedCostItems,
      profile,
    }),
  };
}
