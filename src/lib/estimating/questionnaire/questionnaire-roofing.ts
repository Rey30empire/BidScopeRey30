import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const roofingQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'roofing',
  tradeLabel: 'Roofing',
  intro: 'Set the roof system, insulation basis, and tear-off scope before finalizing the roofing estimate.',
  sections: [
    {
      id: 'roofing-system',
      title: 'Roof System',
      description: 'Choose the primary roof system and the pricing unit driving the estimate.',
      accent: 'gold',
      questions: [
        {
          id: 'roofingSystemType',
          type: 'single_select',
          label: 'Primary roof system',
          defaultValue: 'tpo',
          displayStyle: 'cards',
          options: [
            { value: 'tpo', label: 'TPO', description: 'Single-ply TPO roof system' },
            { value: 'pvc', label: 'PVC', description: 'Single-ply PVC roof system' },
            { value: 'modified_bitumen', label: 'Modified Bitumen', description: 'Torch or cold-process basis' },
            { value: 'metal_roof', label: 'Metal Roofing', description: 'Standing seam or panel system' },
            { value: 'waterproofing', label: 'Waterproofing', description: 'Waterproofing or plaza deck scope' },
          ],
        },
        {
          id: 'roofingPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'sf',
          displayStyle: 'cards',
          options: [
            { value: 'sf', label: 'Per Square Foot', description: 'Area-based carry' },
            { value: 'project', label: 'Per Project', description: 'Full roofing package' },
          ],
        },
      ],
    },
    {
      id: 'roofing-conditions',
      title: 'Roof Conditions',
      description: 'Capture tear-off, insulation, and flashing complexity.',
      accent: 'slate',
      questions: [
        {
          id: 'roofingTearoffRequired',
          type: 'boolean',
          label: 'Include tear-off / demolition',
          defaultValue: false,
        },
        {
          id: 'roofingInsulationBasis',
          type: 'single_select',
          label: 'Insulation basis',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Typical roof insulation package' },
            { value: 'tapered', label: 'Tapered', description: 'Tapered insulation package' },
            { value: 'high_r', label: 'High R-Value', description: 'High-performance insulation carry' },
            { value: 'recover', label: 'Recover', description: 'Recover board or overlay basis' },
          ],
        },
        {
          id: 'roofingFlashingComplexity',
          type: 'single_select',
          label: 'Flashing complexity',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Typical penetrations and edge flashing' },
            { value: 'enhanced', label: 'Enhanced', description: 'Higher parapet / penetration carry' },
            { value: 'intensive', label: 'Intensive', description: 'Heavy curb, edge, and penetration coordination' },
          ],
        },
      ],
    },
  ],
};
