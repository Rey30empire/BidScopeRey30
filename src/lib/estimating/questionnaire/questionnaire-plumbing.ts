import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const plumbingQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'plumbing',
  tradeLabel: 'Plumbing',
  intro: 'Confirm piping basis, fixture scope, testing, and labor method before finalizing the plumbing estimate.',
  sections: [
    {
      id: 'plumbing-material',
      title: 'Piping & Material',
      description: 'Define the pipe system and the unit basis that will drive material carry.',
      accent: 'gold',
      questions: [
        {
          id: 'plumbingPipeType',
          type: 'single_select',
          label: 'Pipe type',
          defaultValue: 'pvc',
          displayStyle: 'cards',
          options: [
            { value: 'pvc', label: 'PVC', description: 'PVC / DWV basis' },
            { value: 'copper', label: 'Copper', description: 'Copper domestic / specialty carry' },
            { value: 'pex', label: 'PEX', description: 'PEX distribution basis' },
            { value: 'cast_iron', label: 'Cast Iron', description: 'Heavy DWV basis' },
            { value: 'undefined', label: 'Not Defined', description: 'Specification pending' },
          ],
        },
        {
          id: 'plumbingMaterialUnit',
          type: 'single_select',
          label: 'Material pricing unit',
          defaultValue: 'lf',
          displayStyle: 'cards',
          options: [
            { value: 'lf', label: 'Per Linear Foot', description: 'Pipe-run basis' },
            { value: 'piece', label: 'Per Piece', description: 'Valve / specialty count' },
            { value: 'fixture', label: 'Per Fixture', description: 'Fixture-level carry' },
            { value: 'lot', label: 'Per Lot', description: 'Bulk plumbing package' },
          ],
        },
        {
          id: 'plumbingWorkType',
          type: 'single_select',
          label: 'Work type',
          defaultValue: 'complete_scope',
          displayStyle: 'cards',
          options: [
            { value: 'rough_in', label: 'Rough-In', description: 'Rough only' },
            { value: 'trim', label: 'Trim', description: 'Trim-out only' },
            { value: 'underground', label: 'Underground', description: 'Below-slab carry' },
            { value: 'above_ceiling', label: 'Above Ceiling', description: 'Overhead distribution' },
            { value: 'complete_scope', label: 'Complete Scope', description: 'Full package' },
          ],
        },
      ],
    },
    {
      id: 'plumbing-scope',
      title: 'Scope Conditions',
      description: 'Include fixture, testing, and insulation decisions that affect final cost carry.',
      accent: 'slate',
      questions: [
        {
          id: 'plumbingFixturesIncluded',
          type: 'boolean',
          label: 'Include fixtures',
          defaultValue: true,
        },
        {
          id: 'plumbingTestingIncluded',
          type: 'boolean',
          label: 'Include testing',
          defaultValue: true,
        },
        {
          id: 'plumbingInsulationIncluded',
          type: 'boolean',
          label: 'Include insulation',
          defaultValue: false,
        },
      ],
    },
  ],
};
