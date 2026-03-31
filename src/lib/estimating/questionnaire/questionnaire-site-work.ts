import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const siteWorkQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'civil',
  tradeLabel: 'Site Work / Civil',
  intro: 'Confirm site package, haul conditions, and traffic control before the civil estimate is finalized.',
  sections: [
    {
      id: 'civil-package',
      title: 'Site Package',
      description: 'Choose the primary civil scope and the unit basis used to carry material and quantities.',
      accent: 'gold',
      questions: [
        {
          id: 'civilPackageType',
          type: 'single_select',
          label: 'Primary package',
          defaultValue: 'earthwork',
          displayStyle: 'cards',
          options: [
            { value: 'earthwork', label: 'Earthwork', description: 'Excavation, grading, and fill carry' },
            { value: 'utilities', label: 'Utilities', description: 'Storm, sanitary, and underground utilities' },
            { value: 'paving', label: 'Paving', description: 'Paving or hardscape package' },
            { value: 'site_concrete', label: 'Site Concrete', description: 'Curbs, walks, and flatwork' },
            { value: 'mixed_site', label: 'Mixed Site Scope', description: 'Combination civil package' },
          ],
        },
        {
          id: 'civilPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'cy',
          displayStyle: 'cards',
          options: [
            { value: 'cy', label: 'Per Cubic Yard', description: 'Earthwork or concrete volume basis' },
            { value: 'lf', label: 'Per Linear Foot', description: 'Pipe-run or utility basis' },
            { value: 'sf', label: 'Per Square Foot', description: 'Paving or hardscape basis' },
            { value: 'project', label: 'Per Project', description: 'Full civil package carry' },
          ],
        },
      ],
    },
    {
      id: 'civil-conditions',
      title: 'Site Conditions',
      description: 'Capture haul conditions, traffic control, and dewatering.',
      accent: 'slate',
      questions: [
        {
          id: 'civilHaulCondition',
          type: 'single_select',
          label: 'Haul condition',
          defaultValue: 'onsite',
          displayStyle: 'cards',
          options: [
            { value: 'onsite', label: 'Onsite Balance', description: 'Minimal off-haul or import' },
            { value: 'import_export', label: 'Import / Export', description: 'Import and export haul carry' },
            { value: 'offhaul', label: 'Off-Haul Heavy', description: 'Heavy trucking and disposal carry' },
          ],
        },
        {
          id: 'civilTrafficControl',
          type: 'boolean',
          label: 'Include traffic control / MOT',
          defaultValue: false,
        },
        {
          id: 'civilDewatering',
          type: 'boolean',
          label: 'Include dewatering / water management',
          defaultValue: false,
        },
      ],
    },
  ],
};
