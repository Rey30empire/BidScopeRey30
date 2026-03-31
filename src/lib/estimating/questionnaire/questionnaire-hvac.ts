import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const hvacQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'hvac',
  tradeLabel: 'HVAC',
  intro: 'Set the mechanical system basis, pricing unit, startup scope, and controls carry from a real HVAC estimate basis.',
  sections: [
    {
      id: 'hvac-system',
      title: 'Mechanical System',
      description: 'Select the primary HVAC system and material basis.',
      accent: 'gold',
      questions: [
        {
          id: 'hvacPrimarySystem',
          type: 'single_select',
          label: 'Primary system',
          defaultValue: 'ductwork',
          displayStyle: 'cards',
          options: [
            { value: 'ductwork', label: 'Ductwork', description: 'Duct distribution package' },
            { value: 'rtu', label: 'RTU / Package Units', description: 'Roof-top unit carry' },
            { value: 'split_systems', label: 'Split Systems', description: 'Split systems and accessories' },
            { value: 'exhaust_makeup', label: 'Exhaust / Makeup Air', description: 'Ventilation package' },
            { value: 'piping_controls', label: 'Piping / Controls', description: 'Mechanical piping and controls' },
          ],
        },
        {
          id: 'hvacPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'project',
          displayStyle: 'cards',
          options: [
            { value: 'ton', label: 'Per Ton', description: 'Equipment tonnage basis' },
            { value: 'lf', label: 'Per Linear Foot', description: 'Duct / piping linear basis' },
            { value: 'ea', label: 'Per Unit', description: 'Piece-count equipment basis' },
            { value: 'system', label: 'Per System', description: 'System-by-system carry' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum package' },
          ],
        },
      ],
    },
    {
      id: 'hvac-installation',
      title: 'Startup & Closeout',
      description: 'Capture install phase, insulation, controls, and testing scope.',
      accent: 'slate',
      questions: [
        {
          id: 'hvacInstallationPhase',
          type: 'single_select',
          label: 'Installation phase',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'rough_in', label: 'Rough-In', description: 'Rough distribution phase' },
            { value: 'trim', label: 'Trim / Set', description: 'Equipment set and trim phase' },
            { value: 'startup', label: 'Startup', description: 'Startup and commissioning phase' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full HVAC package' },
          ],
        },
        {
          id: 'hvacInsulationBasis',
          type: 'single_select',
          label: 'Insulation basis',
          defaultValue: 'standard',
          displayStyle: 'cards',
          options: [
            { value: 'standard', label: 'Standard', description: 'Standard insulation carry' },
            { value: 'field_wrap', label: 'Field Wrap', description: 'Field-applied duct / pipe wrap' },
            { value: 'double_wall', label: 'Double Wall / Specialty', description: 'Specialty insulation system' },
            { value: 'none', label: 'None', description: 'No insulation carried here' },
          ],
        },
        {
          id: 'hvacTestBalanceIncluded',
          type: 'boolean',
          label: 'Include TAB / startup testing',
          defaultValue: true,
        },
        {
          id: 'hvacControlsIncluded',
          type: 'boolean',
          label: 'Include controls / coordination',
          defaultValue: true,
        },
      ],
    },
  ],
};
