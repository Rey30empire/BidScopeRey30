import type { EstimateCostItem, EstimatePricingSummary, EstimateType } from '@/lib/estimate';

export const TRADE_QUESTIONNAIRE_KEYS = [
  'generic',
  'fence',
  'concrete',
  'masonry',
  'electrical',
  'plumbing',
  'doors_hardware',
  'drywall',
  'hvac',
  'specialties',
  'fire_protection',
  'finishes',
  'steel',
  'roofing',
  'glazing',
  'civil',
] as const;

export type TradeQuestionnaireKey = (typeof TRADE_QUESTIONNAIRE_KEYS)[number];

export const QUESTION_DISPLAY_STYLES = ['cards', 'inline', 'compact'] as const;
export type QuestionnaireDisplayStyle = (typeof QUESTION_DISPLAY_STYLES)[number];

export const QUESTION_TYPES = ['single_select', 'boolean', 'number'] as const;
export type QuestionnaireQuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionnaireAnswerValue = string | number | boolean;
export type QuestionnaireAnswerMap = Record<string, QuestionnaireAnswerValue>;

export interface QuestionnaireOption {
  value: string;
  label: string;
  description?: string;
  hint?: string;
}

export interface QuestionnaireQuestionBase {
  id: string;
  label: string;
  description?: string;
  helpText?: string;
  displayStyle?: QuestionnaireDisplayStyle;
  required?: boolean;
}

export interface QuestionnaireSelectQuestion extends QuestionnaireQuestionBase {
  type: 'single_select';
  options: QuestionnaireOption[];
  defaultValue: string;
}

export interface QuestionnaireBooleanQuestion extends QuestionnaireQuestionBase {
  type: 'boolean';
  defaultValue: boolean;
}

export interface QuestionnaireNumberQuestion extends QuestionnaireQuestionBase {
  type: 'number';
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export type QuestionnaireQuestion =
  | QuestionnaireSelectQuestion
  | QuestionnaireBooleanQuestion
  | QuestionnaireNumberQuestion;

export interface QuestionnaireSection {
  id: string;
  title: string;
  description?: string;
  accent?: 'gold' | 'ink' | 'slate';
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireTemplate {
  id: TradeQuestionnaireKey;
  tradeLabel: string;
  intro: string;
  estimateTypes?: EstimateType[];
  sections: QuestionnaireSection[];
}

export interface QuestionnaireSelectionSummaryOption {
  label: string;
  description?: string;
  active?: boolean;
}

export interface QuestionnaireSelectionSummaryBlock {
  title: string;
  prompt: string;
  answer: string;
  supportingText?: string;
  amountLabel?: string;
  options: QuestionnaireSelectionSummaryOption[];
}

export interface QuestionnairePricingField {
  label: string;
  value: string;
}

export interface QuestionnairePresentation {
  sectionTitle: string;
  selectionBlocks: QuestionnaireSelectionSummaryBlock[];
  pricingFields: QuestionnairePricingField[];
  notes: string[];
}

export interface QuestionnaireComputationResult {
  costItems: EstimateCostItem[];
  pricingSummary: EstimatePricingSummary;
  presentation: QuestionnairePresentation;
}

export interface EstimateQuestionnaireState {
  version: number;
  tradeKey: TradeQuestionnaireKey;
  templateId: TradeQuestionnaireKey;
  tradeLabel: string;
  estimateType: EstimateType;
  answers: QuestionnaireAnswerMap;
  baseCostItems: EstimateCostItem[];
  basePricingSummary: EstimatePricingSummary;
  lastComputedAt: string;
  presentation: QuestionnairePresentation;
}

export interface QuestionnaireApiResponse {
  template: QuestionnaireTemplate;
  state: EstimateQuestionnaireState;
  result: QuestionnaireComputationResult;
}
