import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const doorsHardwareQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'doors_hardware',
  tradeLabel: 'Doors, Frames & Hardware',
  intro: 'Carry openings from a real commercial basis: package type, unit basis, frame conditions, and closeout complexity.',
  sections: [
    {
      id: 'doors-package',
      title: 'Openings Package',
      description: 'Select the primary openings package and how it should be priced.',
      accent: 'gold',
      questions: [
        {
          id: 'doorsPackageType',
          type: 'single_select',
          label: 'Primary package',
          defaultValue: 'mixed_package',
          displayStyle: 'cards',
          options: [
            { value: 'hollow_metal', label: 'Hollow Metal', description: 'Hollow metal doors and frames' },
            { value: 'wood_doors', label: 'Wood Doors', description: 'Wood doors and hardware package' },
            { value: 'hardware_only', label: 'Hardware Only', description: 'Hardware furnish / install package' },
            { value: 'mixed_package', label: 'Mixed Package', description: 'Mixed doors, frames, and hardware' },
            { value: 'specialty_openings', label: 'Specialty Openings', description: 'Specialty doors or custom openings' },
          ],
        },
        {
          id: 'doorsPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'opening',
          displayStyle: 'cards',
          options: [
            { value: 'opening', label: 'Per Opening', description: 'Openings-count basis' },
            { value: 'set', label: 'Per Door Set', description: 'Door / frame / hardware set basis' },
            { value: 'ea', label: 'Per Piece / Unit', description: 'Piece-count basis' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum package' },
          ],
        },
        {
          id: 'doorsFireRatedRequired',
          type: 'boolean',
          label: 'Include fire-rated / labeled openings',
          defaultValue: false,
        },
      ],
    },
    {
      id: 'doors-installation',
      title: 'Installation Basis',
      description: 'Capture phase, frame condition, finish coordination, and closeout carry.',
      accent: 'slate',
      questions: [
        {
          id: 'doorsInstallationBasis',
          type: 'single_select',
          label: 'Installation basis',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'supply_install', label: 'Supply & Install', description: 'Furnish and install complete package' },
            { value: 'install_only', label: 'Install Only', description: 'Install owner or GC-furnished material' },
            { value: 'hardware_only', label: 'Hardware Only', description: 'Hardware install / adjustment only' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full door, frame, and hardware carry' },
          ],
        },
        {
          id: 'doorsFrameCondition',
          type: 'single_select',
          label: 'Frame condition',
          defaultValue: 'new_frames',
          displayStyle: 'cards',
          options: [
            { value: 'new_frames', label: 'New Frames', description: 'New frame set and anchor install' },
            { value: 'existing_openings', label: 'Existing Openings', description: 'Existing opening retrofit / coordination' },
            { value: 'mixed_scope', label: 'Mixed Scope', description: 'Combination of new and existing openings' },
          ],
        },
        {
          id: 'doorsFinishCoordination',
          type: 'single_select',
          label: 'Finish coordination',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Standard finish and punch carry' },
            { value: 'custom_finish', label: 'Custom Finish', description: 'Custom finish review and coordination' },
            { value: 'field_touchup', label: 'Field Touch-Up', description: 'Extra touch-up and protection carry' },
          ],
        },
      ],
    },
  ],
};
