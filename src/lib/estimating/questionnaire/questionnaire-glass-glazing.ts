import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const glassGlazingQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'glazing',
  tradeLabel: 'Glass & Glazing',
  intro: 'Carry storefront, glazing, and performance requirements from a commercial basis before export.',
  sections: [
    {
      id: 'glazing-system',
      title: 'Glazing System',
      description: 'Choose the glazing package and the pricing unit used to carry the material scope.',
      accent: 'gold',
      questions: [
        {
          id: 'glazingSystemType',
          type: 'single_select',
          label: 'Primary system',
          defaultValue: 'storefront',
          displayStyle: 'cards',
          options: [
            { value: 'storefront', label: 'Storefront', description: 'Storefront framing and glazing package' },
            { value: 'curtain_wall', label: 'Curtain Wall', description: 'Curtain wall or large system glazing' },
            { value: 'windows', label: 'Windows', description: 'Window package carry' },
            { value: 'mirrors', label: 'Mirrors / Interior Glass', description: 'Interior glass and mirrors' },
            { value: 'mixed_glazing', label: 'Mixed Glazing', description: 'Combination glazing package' },
          ],
        },
        {
          id: 'glazingPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'sf',
          displayStyle: 'cards',
          options: [
            { value: 'sf', label: 'Per Square Foot', description: 'Area-based glass carry' },
            { value: 'opening', label: 'Per Opening', description: 'Opening or elevation basis' },
            { value: 'project', label: 'Per Project', description: 'Complete glazing package' },
          ],
        },
      ],
    },
    {
      id: 'glazing-conditions',
      title: 'Performance & Installation',
      description: 'Capture performance level, retrofit carry, and accessories.',
      accent: 'slate',
      questions: [
        {
          id: 'glazingPerformanceLevel',
          type: 'single_select',
          label: 'Performance level',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Typical tempered / insulated basis' },
            { value: 'thermal', label: 'Thermal', description: 'Enhanced thermal or insulated unit carry' },
            { value: 'impact', label: 'Impact / Security', description: 'Impact-resistant or security glazing' },
            { value: 'specialty', label: 'Specialty', description: 'Custom laminated or decorative glazing' },
          ],
        },
        {
          id: 'glazingInstallCondition',
          type: 'single_select',
          label: 'Install condition',
          defaultValue: 'new_opening',
          displayStyle: 'cards',
          options: [
            { value: 'new_opening', label: 'New Opening', description: 'New construction installation' },
            { value: 'retrofit', label: 'Retrofit', description: 'Existing opening retrofit carry' },
            { value: 'phased', label: 'Phased Install', description: 'Phased or occupied-area install carry' },
          ],
        },
        {
          id: 'glazingHardwareIncluded',
          type: 'boolean',
          label: 'Include hardware / film / closeout accessories',
          defaultValue: true,
        },
      ],
    },
  ],
};
