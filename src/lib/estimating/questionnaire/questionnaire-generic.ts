import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const genericQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'generic',
  tradeLabel: 'General Trade',
  intro: 'Use this fallback questionnaire when the detected trade does not yet have a dedicated template.',
  sections: [
    {
      id: 'generic-basis',
      title: 'Estimate Basis',
      description: 'Capture the commercial basis until a dedicated trade template is available.',
      accent: 'gold',
      questions: [
        {
          id: 'genericMaterialBasis',
          type: 'single_select',
          label: 'Material carry basis',
          defaultValue: 'project',
          displayStyle: 'cards',
          options: [
            { value: 'piece', label: 'Per Piece', description: 'Unit-count material basis' },
            { value: 'lf', label: 'Per Linear Foot', description: 'Linear material basis' },
            { value: 'sf', label: 'Per Square Foot', description: 'Area-based material basis' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum material basis' },
          ],
        },
        {
          id: 'genericInstallationBasis',
          type: 'single_select',
          label: 'Installation basis',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'rough_in', label: 'Rough-In', description: 'Early phase work' },
            { value: 'trim', label: 'Trim / Finish', description: 'Finish phase only' },
            { value: 'repair', label: 'Repair / Partial', description: 'Localized work' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full project carry' },
          ],
        },
      ],
    },
  ],
};
