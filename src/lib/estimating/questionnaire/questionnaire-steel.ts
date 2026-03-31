import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const steelQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'steel',
  tradeLabel: 'Structural Steel',
  intro: 'Set the structural steel package, connection complexity, and erection basis before final pricing.',
  sections: [
    {
      id: 'steel-package',
      title: 'Steel Package',
      description: 'Choose the steel scope and the commercial unit basis for material carry.',
      accent: 'gold',
      questions: [
        {
          id: 'steelPackageType',
          type: 'single_select',
          label: 'Primary package',
          defaultValue: 'structural_frame',
          displayStyle: 'cards',
          options: [
            { value: 'structural_frame', label: 'Structural Frame', description: 'Beams, columns, and bracing' },
            { value: 'misc_steel', label: 'Miscellaneous Steel', description: 'Lintels, embeds, support steel' },
            { value: 'stairs_rails', label: 'Stairs & Rails', description: 'Stairs, rails, and ornamental steel' },
            { value: 'deck_joists', label: 'Deck & Joists', description: 'Deck, joists, and roof support package' },
            { value: 'mixed_steel', label: 'Mixed Steel', description: 'Combination steel package' },
          ],
        },
        {
          id: 'steelPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'ton',
          displayStyle: 'cards',
          options: [
            { value: 'ton', label: 'Per Ton', description: 'Weight-based carry' },
            { value: 'piece', label: 'Per Piece', description: 'Shop piece or assembly basis' },
            { value: 'project', label: 'Per Project', description: 'Complete package carry' },
          ],
        },
      ],
    },
    {
      id: 'steel-conditions',
      title: 'Fabrication & Erection',
      description: 'Carry coating, connection complexity, and erection phasing.',
      accent: 'slate',
      questions: [
        {
          id: 'steelConnectionComplexity',
          type: 'single_select',
          label: 'Connection complexity',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Typical bolted / welded connections' },
            { value: 'moment', label: 'Moment / Seismic', description: 'Higher complexity connection package' },
            { value: 'heavy', label: 'Heavy Coordination', description: 'Field-intensive coordination carry' },
          ],
        },
        {
          id: 'steelCoatingType',
          type: 'single_select',
          label: 'Shop coating',
          defaultValue: 'primer',
          displayStyle: 'cards',
          options: [
            { value: 'primer', label: 'Primer', description: 'Standard prime coat' },
            { value: 'galvanized', label: 'Galvanized', description: 'Hot-dip galvanized carry' },
            { value: 'intumescent', label: 'Intumescent', description: 'Fireproof / specialty coating carry' },
            { value: 'none', label: 'Uncoated', description: 'No shop coating included' },
          ],
        },
        {
          id: 'steelErectionPhase',
          type: 'single_select',
          label: 'Erection phase',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Normal sequencing and crane access' },
            { value: 'phased', label: 'Phased', description: 'Phased erection carry' },
            { value: 'congested', label: 'Congested', description: 'Congested site erection carry' },
          ],
        },
      ],
    },
  ],
};
