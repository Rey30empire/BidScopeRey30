import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const drywallQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'drywall',
  tradeLabel: 'Drywall',
  intro: 'Set the board basis, finish level, framing condition, and accessory carry before finalizing the drywall estimate.',
  sections: [
    {
      id: 'drywall-board',
      title: 'Board Basis',
      description: 'Select board type and material unit for the drywall package.',
      accent: 'gold',
      questions: [
        {
          id: 'drywallBoardType',
          type: 'single_select',
          label: 'Board type',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard Gypsum', description: 'Typical gypsum board carry' },
            { value: 'moisture_resistant', label: 'Moisture Resistant', description: 'MR board carry' },
            { value: 'type_x', label: 'Type X', description: 'Fire-rated drywall package' },
            { value: 'abuse_resistant', label: 'Abuse Resistant', description: 'Higher-duty wallboard carry' },
            { value: 'shaft_wall', label: 'Shaft Wall', description: 'Shaft wall or specialty assembly' },
          ],
        },
        {
          id: 'drywallPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'sf',
          displayStyle: 'cards',
          options: [
            { value: 'sf', label: 'Per Square Foot', description: 'Area-based carry' },
            { value: 'sheet', label: 'Per Sheet', description: 'Sheet-count basis' },
            { value: 'lf', label: 'Per Linear Foot', description: 'Bulkheads / soffits / trims' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum package' },
          ],
        },
      ],
    },
    {
      id: 'drywall-finish',
      title: 'Finish & Accessories',
      description: 'Capture finish level, framing condition, and accessory scope.',
      accent: 'slate',
      questions: [
        {
          id: 'drywallFinishLevel',
          type: 'single_select',
          label: 'Finish level',
          defaultValue: 'level_4',
          displayStyle: 'cards',
          options: [
            { value: 'level_2', label: 'Level 2', description: 'Utility / concealed finish' },
            { value: 'level_4', label: 'Level 4', description: 'Standard paint-ready finish' },
            { value: 'level_5', label: 'Level 5', description: 'Premium skim / high-end finish' },
            { value: 'patch', label: 'Patch / Repair', description: 'Localized patching carry' },
          ],
        },
        {
          id: 'drywallFramingCondition',
          type: 'single_select',
          label: 'Framing condition',
          defaultValue: 'framing_by_others',
          displayStyle: 'cards',
          options: [
            { value: 'framing_by_others', label: 'Framing by Others', description: 'Board and finish only' },
            { value: 'existing_framing', label: 'Existing Framing', description: 'Coordination with existing substrate' },
            { value: 'full_assembly', label: 'Full Assembly', description: 'Framing and board package' },
          ],
        },
        {
          id: 'drywallInsulationIncluded',
          type: 'boolean',
          label: 'Include insulation coordination',
          defaultValue: false,
        },
        {
          id: 'drywallSealantIncluded',
          type: 'boolean',
          label: 'Include acoustical / perimeter sealant',
          defaultValue: false,
        },
      ],
    },
  ],
};
