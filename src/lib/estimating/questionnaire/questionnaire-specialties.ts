import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const specialtiesQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'specialties',
  tradeLabel: 'Specialties',
  intro: 'Confirm specialty package type, anchorage, and field conditions before locking the estimate.',
  sections: [
    {
      id: 'specialties-package',
      title: 'Specialty Package',
      description: 'Choose the package mix and commercial unit basis driving the estimate.',
      accent: 'gold',
      questions: [
        {
          id: 'specialtiesPackageType',
          type: 'single_select',
          label: 'Primary package',
          defaultValue: 'partitions_accessories',
          displayStyle: 'cards',
          options: [
            { value: 'partitions_accessories', label: 'Partitions & Accessories', description: 'Restroom specialties package' },
            { value: 'accessories_only', label: 'Accessories Only', description: 'Accessory furnish / install basis' },
            { value: 'toilet_partitions', label: 'Toilet Partitions', description: 'Partition package carry' },
            { value: 'vertical_transport', label: 'Vertical Transport', description: 'Lift / elevator / platform package' },
            { value: 'mixed_specialties', label: 'Mixed Specialties', description: 'Multiple specialty systems' },
          ],
        },
        {
          id: 'specialtiesPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'piece',
          displayStyle: 'cards',
          options: [
            { value: 'piece', label: 'Per Piece', description: 'Device or accessory count' },
            { value: 'opening', label: 'Per Opening / Group', description: 'Opening or room-group basis' },
            { value: 'system', label: 'Per System', description: 'System or lift basis' },
            { value: 'project', label: 'Per Project', description: 'Complete specialty package' },
          ],
        },
      ],
    },
    {
      id: 'specialties-installation',
      title: 'Installation Conditions',
      description: 'Capture retrofit conditions, anchorage, and closeout effort.',
      accent: 'slate',
      questions: [
        {
          id: 'specialtiesInstallCondition',
          type: 'single_select',
          label: 'Install condition',
          defaultValue: 'new_work',
          displayStyle: 'cards',
          options: [
            { value: 'new_work', label: 'New Work', description: 'New construction basis' },
            { value: 'retrofit', label: 'Retrofit', description: 'Existing conditions / coordination carry' },
            { value: 'phased', label: 'Phased Occupied Work', description: 'Occupied or phased install carry' },
          ],
        },
        {
          id: 'specialtiesAnchorageIncluded',
          type: 'boolean',
          label: 'Include blocking / anchorage / backing',
          defaultValue: true,
        },
        {
          id: 'specialtiesCloseoutIncluded',
          type: 'boolean',
          label: 'Include punch, adjustments, and closeout',
          defaultValue: true,
        },
      ],
    },
  ],
};
