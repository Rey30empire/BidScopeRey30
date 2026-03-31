import type { QuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-types';

export const concreteQuestionnaireTemplate: QuestionnaireTemplate = {
  id: 'concrete',
  tradeLabel: 'Concrete',
  intro: 'Define concrete presentation, strength, scope type, and labor basis before carrying the final estimate.',
  sections: [
    {
      id: 'concrete-material',
      title: 'Concrete Material',
      description: 'Choose how concrete will be purchased and what technical basis the carry should follow.',
      accent: 'gold',
      questions: [
        {
          id: 'concretePresentation',
          type: 'single_select',
          label: 'Material presentation',
          defaultValue: 'cubic_yard',
          displayStyle: 'cards',
          options: [
            { value: 'cubic_yard', label: 'Per Cubic Yard', description: 'Ready-mix / CY basis' },
            { value: 'bag', label: 'Per Bag', description: 'Bagged material basis' },
            { value: 'truck', label: 'Per Truck', description: 'Truckload / batch basis' },
            { value: 'strip', label: 'Per Strip / Run', description: 'Linear pour basis' },
          ],
        },
        {
          id: 'concreteStrength',
          type: 'single_select',
          label: 'Concrete strength',
          defaultValue: '3000',
          displayStyle: 'cards',
          options: [
            { value: '2500', label: '2500 PSI', description: 'Light-duty carry' },
            { value: '3000', label: '3000 PSI', description: 'Standard slab / flatwork' },
            { value: '4000', label: '4000 PSI', description: 'Higher-strength carry' },
            { value: 'custom', label: 'Custom', description: 'Project-specific mix' },
          ],
        },
        {
          id: 'concreteThickness',
          type: 'single_select',
          label: 'Thickness',
          defaultValue: '4_in',
          displayStyle: 'cards',
          options: [
            { value: '4_in', label: '4 in', description: 'Standard flatwork' },
            { value: '6_in', label: '6 in', description: 'Heavier slab / approach' },
            { value: '8_in', label: '8 in', description: 'Heavy-duty basis' },
            { value: 'custom', label: 'Custom', description: 'Project-specific thickness' },
          ],
        },
      ],
    },
    {
      id: 'concrete-work',
      title: 'Placement & Finish',
      description: 'Capture reinforcement, finish quality, and unit basis for the takeoff carry.',
      accent: 'slate',
      questions: [
        {
          id: 'concreteWorkType',
          type: 'single_select',
          label: 'Work type',
          defaultValue: 'slab',
          displayStyle: 'cards',
          options: [
            { value: 'slab', label: 'Slab', description: 'Main slab-on-grade' },
            { value: 'footing', label: 'Footing', description: 'Footing / foundation basis' },
            { value: 'sidewalk', label: 'Sidewalk', description: 'Sidewalk / walk path' },
            { value: 'driveway', label: 'Driveway', description: 'Drive / paving carry' },
            { value: 'curb', label: 'Curb', description: 'Curb or edge work' },
            { value: 'patch', label: 'Patch', description: 'Repair / patch basis' },
            { value: 'wall', label: 'Wall', description: 'Vertical formwork carry' },
          ],
        },
        {
          id: 'concreteReinforcement',
          type: 'single_select',
          label: 'Reinforcement',
          defaultValue: 'rebar',
          displayStyle: 'cards',
          options: [
            { value: 'none', label: 'No Reinforcement', description: 'Plain concrete carry' },
            { value: 'rebar', label: 'Rebar', description: 'Rebar reinforcing basis' },
            { value: 'wire_mesh', label: 'Wire Mesh', description: 'WWR / mesh basis' },
          ],
        },
        {
          id: 'concreteFinishType',
          type: 'single_select',
          label: 'Finish type',
          defaultValue: 'broom',
          displayStyle: 'cards',
          options: [
            { value: 'broom', label: 'Broom Finish', description: 'Standard exterior finish' },
            { value: 'smooth', label: 'Smooth Finish', description: 'Interior / trowel finish' },
            { value: 'stamped', label: 'Stamped', description: 'Decorative finish carry' },
            { value: 'exposed', label: 'Exposed Aggregate', description: 'Premium exposed finish' },
          ],
        },
        {
          id: 'concretePricingUnit',
          type: 'single_select',
          label: 'Pricing unit',
          defaultValue: 'cy',
          displayStyle: 'cards',
          options: [
            { value: 'cy', label: 'Per Cubic Yard', description: 'Material-heavy billing' },
            { value: 'sf', label: 'Per Square Foot', description: 'Flatwork billing' },
            { value: 'project', label: 'Per Project', description: 'Lump-sum basis' },
          ],
        },
      ],
    },
  ],
};
