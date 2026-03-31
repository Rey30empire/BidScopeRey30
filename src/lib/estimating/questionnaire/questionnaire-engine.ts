import type { EstimateCostItem, EstimatePricingSummary, EstimateType } from '@/lib/estimate';
import { TRADE_OPTIONS } from '@/lib/constants';
import { safeJsonParse } from '@/lib/server/json';
import { applyEstimateQuestionnairePricing } from '@/lib/estimating/questionnaire/estimate-pricing-engine';
import {
  getQuestionnaireTemplateByKey,
  normalizeTradeToQuestionnaireKey,
} from '@/lib/estimating/questionnaire/questionnaire-registry';
import type {
  EstimateQuestionnaireState,
  QuestionnaireAnswerMap,
  QuestionnaireComputationResult,
  QuestionnaireQuestion,
  QuestionnaireTemplate,
  TradeQuestionnaireKey,
} from '@/lib/estimating/questionnaire/questionnaire-types';

const QUESTIONNAIRE_STATE_VERSION = 1;

function normalizeTradeLabelToken(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveQuestionnaireTradeLabel(inputTrade: string | null | undefined, fallbackLabel: string) {
  const normalized = normalizeTradeLabelToken(inputTrade);
  if (!normalized) {
    return fallbackLabel;
  }

  const matchedTradeOption = TRADE_OPTIONS.find((tradeOption) => {
    if (tradeOption.value === normalized) {
      return true;
    }

    if (normalizeTradeLabelToken(tradeOption.label) === normalized) {
      return true;
    }

    return tradeOption.keywords.some((keyword) => normalized.includes(normalizeTradeLabelToken(keyword)));
  });

  return matchedTradeOption?.label || inputTrade?.trim() || fallbackLabel;
}

function getQuestionDefaultValue(question: QuestionnaireQuestion) {
  return question.defaultValue;
}

function buildDefaultAnswers(template: QuestionnaireTemplate): QuestionnaireAnswerMap {
  const answers: QuestionnaireAnswerMap = {};
  for (const section of template.sections) {
    for (const question of section.questions) {
      answers[question.id] = getQuestionDefaultValue(question);
    }
  }
  return answers;
}

function normalizeAnswers(template: QuestionnaireTemplate, incoming: QuestionnaireAnswerMap | null | undefined) {
  const defaults = buildDefaultAnswers(template);
  if (!incoming) return defaults;
  const merged: QuestionnaireAnswerMap = { ...defaults };
  for (const section of template.sections) {
    for (const question of section.questions) {
      const raw = incoming[question.id];
      if (question.type === 'number') {
        merged[question.id] = typeof raw === 'number' && Number.isFinite(raw) ? raw : question.defaultValue;
      } else if (question.type === 'boolean') {
        merged[question.id] = typeof raw === 'boolean' ? raw : question.defaultValue;
      } else {
        merged[question.id] = typeof raw === 'string' && question.options.some((option) => option.value === raw)
          ? raw
          : question.defaultValue;
      }
    }
  }
  return merged;
}

export function buildQuestionnaireState(input: {
  trade: string | null | undefined;
  estimateType: EstimateType;
  baseCostItems: EstimateCostItem[];
  basePricingSummary: EstimatePricingSummary;
  existingState?: string | null;
}): {
  template: QuestionnaireTemplate;
  state: EstimateQuestionnaireState;
  result: QuestionnaireComputationResult;
} {
  const parsed = safeJsonParse<EstimateQuestionnaireState | null>(input.existingState, null);
  const detectedKey = normalizeTradeToQuestionnaireKey(input.trade);
  const parsedKey = parsed?.templateId
    ? getQuestionnaireTemplateByKey(parsed.templateId as TradeQuestionnaireKey).id
    : null;
  const key =
    parsedKey && !(parsedKey === 'generic' && detectedKey !== 'generic')
      ? (parsedKey as TradeQuestionnaireKey)
      : detectedKey;
  const template = getQuestionnaireTemplateByKey(key);
  const answers = normalizeAnswers(template, parsed?.answers);

  const state: EstimateQuestionnaireState = {
    version: QUESTIONNAIRE_STATE_VERSION,
    tradeKey: key,
    templateId: template.id,
    tradeLabel: resolveQuestionnaireTradeLabel(input.trade, template.tradeLabel),
    estimateType: input.estimateType,
    answers,
    baseCostItems: input.baseCostItems,
    basePricingSummary: {
      ...input.basePricingSummary,
      budgetary: input.estimateType === 'global',
    },
    lastComputedAt: new Date().toISOString(),
    presentation: parsed?.presentation ?? {
      sectionTitle: `${resolveQuestionnaireTradeLabel(input.trade, template.tradeLabel)} Estimating Questionnaire`,
      selectionBlocks: [],
      pricingFields: [],
      notes: [],
    },
  };

  const result = applyEstimateQuestionnairePricing(state);
  state.presentation = result.presentation;
  state.lastComputedAt = new Date().toISOString();

  return { template, state, result };
}

export function updateQuestionnaireAnswers(input: {
  existingState: string | null | undefined;
  trade: string | null | undefined;
  estimateType: EstimateType;
  baseCostItems: EstimateCostItem[];
  basePricingSummary: EstimatePricingSummary;
  answers: QuestionnaireAnswerMap;
}) {
  const hydrated = buildQuestionnaireState({
    trade: input.trade,
    estimateType: input.estimateType,
    baseCostItems: input.baseCostItems,
    basePricingSummary: input.basePricingSummary,
    existingState: input.existingState,
  });

  const mergedAnswers = {
    ...hydrated.state.answers,
    ...input.answers,
  };

  return buildQuestionnaireState({
    trade: input.trade,
    estimateType: input.estimateType,
    baseCostItems: input.baseCostItems,
    basePricingSummary: input.basePricingSummary,
    existingState: JSON.stringify({
      ...hydrated.state,
      answers: mergedAnswers,
      tradeLabel: resolveQuestionnaireTradeLabel(input.trade, hydrated.template.tradeLabel),
    }),
  });
}
