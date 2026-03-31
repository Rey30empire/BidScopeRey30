import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const masonryQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'masonry',
  tradeLabel: 'Masonry',
  intro: 'Carry the masonry estimate from a real production basis: material system, pricing unit, access, and finish extras.',
  sections: [
    {
      id: 'masonry-material',
      title: 'Masonry Material',
      description: 'Select the primary masonry system and how it should be carried.',
      accent: 'gold',
      questions: [
        {
          id: 'masonryMaterialType',
          type: 'single_select',
          label: 'Primary material',
          defaultValue: 'thin_brick',
          displayStyle: 'cards',
          options: [
            { value: 'thin_brick', label: 'Thin Brick', description: 'Thin brick veneer system' },
            { value: 'full_brick', label: 'Full Brick', description: 'Full masonry brick carry' },
            { value: 'cmu', label: 'CMU', description: 'Concrete masonry units' },
            { value: 'limestone', label: 'Limestone', description: 'Limestone veneer / veneer system' },
            { value: 'stone_veneer', label: 'Stone Veneer', description: 'Natural or manufactured stone' },
          ],
        },
        {
          id: 'masonryPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'sf',
          displayStyle: 'cards',
          options: [
            { value: 'sf', label: 'Per Square Foot', description: 'Facade / veneer carry' },
            { value: 'ea', label: 'Per Piece / Unit', description: 'Unit count basis' },
            { value: 'lf', label: 'Per Linear Foot', description: 'Trim / band / coping basis' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum package' },
          ],
        },
        {
          id: 'masonryMortarType',
          type: 'single_select',
          label: 'Mortar / grout basis',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Standard mortar/grout carry' },
            { value: 'colored', label: 'Colored', description: 'Colored mortar carry' },
            { value: 'high_performance', label: 'High Performance', description: 'Specialty mix carry' },
          ],
        },
      ],
    },
    {
      id: 'masonry-scope',
      title: 'Access & Finish',
      description: 'Capture scaffold, sealants, and closeout items that change production or commercial carry.',
      accent: 'slate',
      questions: [
        {
          id: 'masonryScaffoldRequired',
          type: 'boolean',
          label: 'Include scaffold / elevated access',
          defaultValue: false,
        },
        {
          id: 'masonrySealantIncluded',
          type: 'boolean',
          label: 'Include sealant / waterproofing coordination',
          defaultValue: false,
        },
        {
          id: 'masonryCleanupScope',
          type: 'single_select',
          label: 'Cleanup level',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Typical cleanup and punch' },
            { value: 'enhanced', label: 'Enhanced', description: 'Extra final wash / detailed clean' },
            { value: 'premium', label: 'Premium', description: 'Heightened finish and protection carry' },
          ],
        },
      ],
    },
  ],
};
