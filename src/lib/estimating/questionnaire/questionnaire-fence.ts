import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const fenceQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'fence',
  tradeLabel: 'Fence',
  intro: 'Confirm fence material, installation basis, and labor structure before the estimate is finalized.',
  sections: [
    {
      id: 'fence-material',
      title: 'Fence Material',
      description: 'Select the primary material and how it will be bought or charged.',
      accent: 'gold',
      questions: [
        {
          id: 'fenceMaterialType',
          type: 'single_select',
          label: 'Primary material',
          defaultValue: 'cedar',
          displayStyle: 'cards',
          options: [
            { value: 'cedar', label: 'Cedar', description: 'Premium wood appearance' },
            { value: 'treated_pine', label: 'Treated Pine', description: 'Cost-conscious wood option' },
            { value: 'redwood', label: 'Redwood', description: 'Higher-end wood selection' },
            { value: 'metal', label: 'Metal', description: 'Commercial metal fencing' },
            { value: 'chain_link', label: 'Chain Link', description: 'Utility / perimeter basis' },
            { value: 'vinyl', label: 'Vinyl', description: 'Low-maintenance finish' },
            { value: 'composite', label: 'Composite', description: 'Premium composite panels' },
          ],
        },
        {
          id: 'fenceHeight',
          type: 'single_select',
          label: 'Fence height',
          defaultValue: '6_ft',
          displayStyle: 'cards',
          options: [
            { value: '4_ft', label: '4 ft', description: 'Low perimeter height' },
            { value: '6_ft', label: '6 ft', description: 'Standard privacy height' },
            { value: '8_ft', label: '8 ft', description: 'Tall privacy/security height' },
            { value: 'custom', label: 'Custom', description: 'Non-standard height allowance' },
          ],
        },
        {
          id: 'fenceMaterialPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'lf',
          displayStyle: 'cards',
          options: [
            { value: 'lf', label: 'Per Linear Foot', description: 'LF-based pricing' },
            { value: 'post', label: 'Per Post', description: 'Post-count carry' },
            { value: 'panel', label: 'Per Panel', description: 'Panelized fence material' },
            { value: 'project', label: 'Per Lot / Project', description: 'Lump-sum carry' },
          ],
        },
        {
          id: 'fenceQuantityBuffer',
          type: 'single_select',
          label: 'Minimum quantity carry',
          defaultValue: '10',
          displayStyle: 'cards',
          options: [
            { value: '0', label: 'Exact', description: 'No additional quantity carry' },
            { value: '10', label: '+10%', description: 'Standard field cushion' },
            { value: '15', label: '+15%', description: 'Higher field cushion' },
            { value: '20', label: '+20%', description: 'Heavy material cushion' },
          ],
        },
      ],
    },
    {
      id: 'fence-installation',
      title: 'Installation Basis',
      description: 'Capture scope conditions that change production or extra scope carry.',
      accent: 'slate',
      questions: [
        {
          id: 'fencePostType',
          type: 'single_select',
          label: 'Post type',
          defaultValue: 'wood',
          displayStyle: 'cards',
          options: [
            { value: 'wood', label: 'Wood', description: 'Wood post system' },
            { value: 'metal', label: 'Metal', description: 'Metal post system' },
            { value: 'concrete', label: 'Concrete', description: 'Concrete or masonry post basis' },
          ],
        },
        {
          id: 'fenceInstallationType',
          type: 'single_select',
          label: 'Installation type',
          defaultValue: 'new',
          displayStyle: 'cards',
          options: [
            { value: 'new', label: 'New Installation', description: 'Greenfield install basis' },
            { value: 'replacement', label: 'Replacement', description: 'Existing fence replacement' },
            { value: 'repair', label: 'Repair Partial', description: 'Localized replacement/repair' },
          ],
        },
        {
          id: 'fenceRemovalRequired',
          type: 'boolean',
          label: 'Remove existing fence',
          defaultValue: false,
        },
        {
          id: 'fenceFinishRequired',
          type: 'boolean',
          label: 'Include stain / sealer / finish',
          defaultValue: false,
        },
        {
          id: 'fenceGateRequired',
          type: 'boolean',
          label: 'Include gates',
          defaultValue: false,
        },
      ],
    },
  ],
};
