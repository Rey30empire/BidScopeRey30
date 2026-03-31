import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const fireProtectionQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'fire_protection',
  tradeLabel: 'Fire Protection',
  intro: 'Set the system basis, testing carry, and field coordination before the fire protection estimate is finalized.',
  sections: [
    {
      id: 'fire-protection-system',
      title: 'System Basis',
      description: 'Select the fire protection package and unit basis driving material carry.',
      accent: 'gold',
      questions: [
        {
          id: 'fireProtectionSystemType',
          type: 'single_select',
          label: 'System type',
          defaultValue: 'sprinkler',
          displayStyle: 'cards',
          options: [
            { value: 'sprinkler', label: 'Sprinkler', description: 'Wet / dry sprinkler piping package' },
            { value: 'standpipe', label: 'Standpipe', description: 'Standpipe and riser basis' },
            { value: 'fire_pump', label: 'Fire Pump Room', description: 'Pump room / equipment package' },
            { value: 'alarm_coordination', label: 'Alarm Coordination', description: 'Alarm / device coordination carry' },
            { value: 'mixed', label: 'Mixed System', description: 'Combination fire protection scope' },
          ],
        },
        {
          id: 'fireProtectionPricingUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'lf',
          displayStyle: 'cards',
          options: [
            { value: 'lf', label: 'Per Linear Foot', description: 'Pipe-run basis' },
            { value: 'piece', label: 'Per Piece', description: 'Heads, valves, and devices' },
            { value: 'system', label: 'Per System', description: 'Riser or room package' },
            { value: 'project', label: 'Per Project', description: 'Full package carry' },
          ],
        },
        {
          id: 'fireProtectionInstallPhase',
          type: 'single_select',
          label: 'Install phase',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'underground', label: 'Underground', description: 'Underground or site fire line scope' },
            { value: 'overhead', label: 'Overhead', description: 'Overhead sprinkler piping basis' },
            { value: 'trim', label: 'Trim / Device Install', description: 'Heads, drops, and trim only' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full fire protection package' },
          ],
        },
      ],
    },
    {
      id: 'fire-protection-coordination',
      title: 'Coordination & Closeout',
      description: 'Capture testing, seismic bracing, and commissioning carry.',
      accent: 'slate',
      questions: [
        {
          id: 'fireProtectionSeismicIncluded',
          type: 'boolean',
          label: 'Include seismic bracing',
          defaultValue: true,
        },
        {
          id: 'fireProtectionTestingIncluded',
          type: 'boolean',
          label: 'Include testing / inspections',
          defaultValue: true,
        },
        {
          id: 'fireProtectionDrainFillIncluded',
          type: 'boolean',
          label: 'Include drain, fill, and final turnover',
          defaultValue: true,
        },
      ],
    },
  ],
};
