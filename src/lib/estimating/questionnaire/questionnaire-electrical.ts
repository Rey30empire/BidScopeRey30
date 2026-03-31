import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const electricalQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'electrical',
  tradeLabel: 'Electrical',
  intro: 'Select the electrical system basis, material charging method, and labor/complexity carry before the estimate is finalized.',
  sections: [
    {
      id: 'electrical-material',
      title: 'Electrical Material',
      description: 'Choose the primary material carry and how it should be billed.',
      accent: 'gold',
      questions: [
        {
          id: 'electricalPrimaryMaterial',
          type: 'single_select',
          label: 'Primary material basis',
          defaultValue: 'fixtures',
          displayStyle: 'cards',
          options: [
            { value: 'emt', label: 'Conduit EMT', description: 'EMT and fittings' },
            { value: 'pvc', label: 'Conduit PVC', description: 'PVC and underground raceway' },
            { value: 'mc_cable', label: 'MC Cable', description: 'MC distribution basis' },
            { value: 'copper_wire', label: 'Copper Wire', description: 'Wire-heavy carry' },
            { value: 'panelboards', label: 'Panelboards', description: 'Panel and gear basis' },
            { value: 'devices', label: 'Devices', description: 'Boxes, devices, terminations' },
            { value: 'fixtures', label: 'Fixtures', description: 'Fixture package carry' },
          ],
        },
        {
          id: 'electricalMaterialPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'lf',
          displayStyle: 'cards',
          options: [
            { value: 'lf', label: 'Per Linear Foot', description: 'Raceway / cable basis' },
            { value: 'piece', label: 'Per Piece', description: 'Device / fixture count' },
            { value: 'circuit', label: 'Per Circuit', description: 'Circuit-level carry' },
            { value: 'panel', label: 'Per Panel', description: 'Panel basis' },
            { value: 'lot', label: 'Per Lot', description: 'Bulk package carry' },
          ],
        },
        {
          id: 'electricalComplexity',
          type: 'single_select',
          label: 'Complexity',
          defaultValue: 'medium',
          displayStyle: 'cards',
          options: [
            { value: 'low', label: 'Low', description: 'Straightforward routing and devices' },
            { value: 'medium', label: 'Medium', description: 'Typical commercial coordination' },
            { value: 'high', label: 'High', description: 'Tight coordination / detailed install' },
          ],
        },
      ],
    },
    {
      id: 'electrical-installation',
      title: 'Installation Basis',
      description: 'Capture phase, testing, and closeout requirements that change labor carry.',
      accent: 'slate',
      questions: [
        {
          id: 'electricalInstallationPhase',
          type: 'single_select',
          label: 'Installation phase',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'rough_in', label: 'Rough-In', description: 'Rough-in only' },
            { value: 'trim', label: 'Trim', description: 'Trim-out only' },
            { value: 'final', label: 'Final', description: 'Startup / final only' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full installation basis' },
          ],
        },
        {
          id: 'electricalTestingCloseout',
          type: 'boolean',
          label: 'Include testing, labeling, and closeout',
          defaultValue: true,
        },
      ],
    },
  ],
};
