import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const finishesQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'finishes',
  tradeLabel: 'Architectural Finishes',
  intro: 'Define the finish package, substrate prep, and presentation basis before finalizing the estimate.',
  sections: [
    {
      id: 'finishes-package',
      title: 'Finish Package',
      description: 'Choose the primary finish scope and the unit used to carry material.',
      accent: 'gold',
      questions: [
        {
          id: 'finishesPackageType',
          type: 'single_select',
          label: 'Primary finish scope',
          defaultValue: 'painting',
          displayStyle: 'cards',
          options: [
            { value: 'painting', label: 'Painting', description: 'Paint and coatings basis' },
            { value: 'flooring', label: 'Flooring', description: 'Tile, resilient, carpet, or wood flooring' },
            { value: 'wallcovering', label: 'Wallcovering', description: 'Wallcovering or decorative finish package' },
            { value: 'epoxy_coatings', label: 'Epoxy / Specialty Coatings', description: 'Specialty coating carry' },
            { value: 'mixed_finishes', label: 'Mixed Finishes', description: 'Combination finish package' },
          ],
        },
        {
          id: 'finishesPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'sf',
          displayStyle: 'cards',
          options: [
            { value: 'sf', label: 'Per Square Foot', description: 'Area-based carry' },
            { value: 'piece', label: 'Per Piece / Room', description: 'Room or fixture count basis' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum finish package' },
          ],
        },
      ],
    },
    {
      id: 'finishes-conditions',
      title: 'Surface Conditions',
      description: 'Capture prep, premium finishes, and environmental mitigation needs.',
      accent: 'slate',
      questions: [
        {
          id: 'finishesSubstrateCondition',
          type: 'single_select',
          label: 'Substrate condition',
          defaultValue: 'ready',
          displayStyle: 'cards',
          options: [
            { value: 'ready', label: 'Ready', description: 'Substrate ready for finish application' },
            { value: 'moderate_prep', label: 'Moderate Prep', description: 'Typical prep and patching carry' },
            { value: 'heavy_prep', label: 'Heavy Prep', description: 'Extensive prep or leveling carry' },
          ],
        },
        {
          id: 'finishesMoistureMitigation',
          type: 'boolean',
          label: 'Include moisture mitigation / primers',
          defaultValue: false,
        },
        {
          id: 'finishesPremiumFinish',
          type: 'boolean',
          label: 'Include premium finish level',
          defaultValue: false,
        },
      ],
    },
  ],
};
