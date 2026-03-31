import { toCurrency, type EstimateCostItem, type EstimatePricingSummary } from '@/lib/estimate';
import { resolveLaborModelLabel, resolvePricingUnitLabel } from '@/lib/estimating/questionnaire/estimate-unit-resolver';
import { getQuestionnaireTemplateByKey } from '@/lib/estimating/questionnaire/questionnaire-registry';
import type {
  EstimateQuestionnaireState,
  QuestionnaireAnswerMap,
  QuestionnaireComputationResult,
  QuestionnaireOption,
  QuestionnairePresentation,
  QuestionnairePricingField,
  QuestionnaireQuestion,
  QuestionnaireSection,
  TradeQuestionnaireKey,
} from '@/lib/estimating/questionnaire/questionnaire-types';

type AdjustmentProfile = {
  materialMultiplier: number;
  laborMultiplier: number;
  equipmentMultiplier: number;
  quantityMultiplier: number;
  contingencyPercent: number;
  taxPercent: number;
  notes: string[];
  pricingFields: QuestionnairePricingField[];
  materialUnitLabel: string;
  laborModelLabel: string;
  extraItems: EstimateCostItem[];
  selectionAnswerLookup: Record<string, string>;
};

function roundMoney(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

function numberAnswer(answers: QuestionnaireAnswerMap, id: string, fallback = 0) {
  const value = answers[id];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function stringAnswer(answers: QuestionnaireAnswerMap, id: string, fallback = '') {
  const value = answers[id];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function booleanAnswer(answers: QuestionnaireAnswerMap, id: string, fallback = false) {
  const value = answers[id];
  return typeof value === 'boolean' ? value : fallback;
}

function getQuestionLabelValue(question: QuestionnaireQuestion, answers: QuestionnaireAnswerMap) {
  if (question.type === 'boolean') {
    return booleanAnswer(answers, question.id, question.defaultValue) ? 'Yes' : 'No';
  }
  if (question.type === 'number') {
    const value = numberAnswer(answers, question.id, question.defaultValue);
    return `${value}${question.suffix || ''}`;
  }
  const current = stringAnswer(answers, question.id, question.defaultValue);
  const option = question.options.find((item) => item.value === current);
  return option?.label || current;
}

function getSelectedOption(question: QuestionnaireQuestion, answers: QuestionnaireAnswerMap): QuestionnaireOption | null {
  if (question.type !== 'single_select') return null;
  const current = stringAnswer(answers, question.id, question.defaultValue);
  return question.options.find((item) => item.value === current) || null;
}

function buildSelectionBlocks(
  tradeKey: TradeQuestionnaireKey,
  sections: QuestionnaireSection[],
  answers: QuestionnaireAnswerMap,
  costItems: EstimateCostItem[],
): QuestionnairePresentation['selectionBlocks'] {
  return sections
    .filter((section) => !['commercial-basis', 'job-conditions'].includes(section.id))
    .map((section, index) => {
      const primaryQuestion = section.questions[0];
      const answerPairs = section.questions.map((question) => ({
        label: question.label,
        value: getQuestionLabelValue(question, answers),
      }));

      return {
        title: section.title,
        prompt: section.description || primaryQuestion?.label || 'Selected estimating basis',
        answer: answerPairs.map((pair) => `${pair.label}: ${pair.value}`).join(' • '),
        supportingText: costItems[index]?.description || undefined,
        amountLabel: costItems[index] ? toCurrency(costItems[index].subtotal) : undefined,
        options: answerPairs.map((pair) => ({
          label: pair.value,
          description: pair.label,
          active: true,
        })),
      };
    });
}

function makeLineItem(id: string, description: string, materialCost: number, laborCost: number, equipmentCost = 0): EstimateCostItem {
  return {
    id,
    description,
    quantity: 1,
    unit: 'LS',
    materialCost: roundMoney(materialCost),
    laborCost: roundMoney(laborCost),
    equipmentCost: roundMoney(equipmentCost),
    subcontractCost: 0,
    subtotal: roundMoney(materialCost + laborCost + equipmentCost),
  };
}

export function mapQuestionnaireAnswersToPricingProfile(input: {
  state: EstimateQuestionnaireState;
  currentCostItems?: EstimateCostItem[];
  currentPricingSummary?: EstimatePricingSummary;
}): AdjustmentProfile {
  const { state } = input;
  const template = getQuestionnaireTemplateByKey(state.templateId);
  const answers = state.answers;
  const notes: string[] = [];
  const extraItems: EstimateCostItem[] = [];

  const wastePercent = numberAnswer(answers, 'wastePercent', 10);
  const materialMarkupPercent = numberAnswer(answers, 'materialMarkupPercent', 5);
  const contingencyPercent = numberAnswer(answers, 'contingencyPercent', state.basePricingSummary.contingencyPercent || 3);
  const taxPercent = numberAnswer(answers, 'taxPercent', state.basePricingSummary.taxPercent || 0);

  let materialMultiplier = 1 + wastePercent / 100 + materialMarkupPercent / 100;
  let laborMultiplier = 1;
  let equipmentMultiplier = 1;
  let quantityMultiplier = 1;

  const laborPricingModel = stringAnswer(answers, 'laborPricingModel', 'crew');
  if (laborPricingModel === 'day') laborMultiplier += 0.02;
  if (laborPricingModel === 'person') laborMultiplier += 0.03;
  if (laborPricingModel === 'crew') laborMultiplier += 0.05;
  if (laborPricingModel === 'project') laborMultiplier += 0;

  const accessDifficulty = stringAnswer(answers, 'accessDifficulty', 'standard');
  if (accessDifficulty === 'restricted') {
    laborMultiplier += 0.05;
    equipmentMultiplier += 0.03;
    notes.push('Restricted site access carried in labor and equipment production.');
  }
  if (accessDifficulty === 'congested') {
    laborMultiplier += 0.1;
    equipmentMultiplier += 0.05;
    notes.push('Congested site conditions carried in labor and equipment production.');
  }

  const scheduleUrgency = stringAnswer(answers, 'scheduleUrgency', 'standard');
  if (scheduleUrgency === 'accelerated') {
    laborMultiplier += 0.06;
    equipmentMultiplier += 0.02;
    notes.push('Accelerated schedule allowance applied to labor carry.');
  }
  if (scheduleUrgency === 'rush') {
    laborMultiplier += 0.12;
    equipmentMultiplier += 0.04;
    notes.push('Rush schedule allowance applied to labor carry.');
  }

  if (booleanAnswer(answers, 'overtimeRequired', false)) {
    laborMultiplier += 0.12;
    notes.push('Overtime / premium time allowance applied.');
  }

  const tradeKey = state.tradeKey;
  if (tradeKey === 'fence') {
    const materialType = stringAnswer(answers, 'fenceMaterialType', 'cedar');
    const height = stringAnswer(answers, 'fenceHeight', '6_ft');
    const installType = stringAnswer(answers, 'fenceInstallationType', 'new');
    const quantityBuffer = numberAnswer(answers, 'fenceQuantityBuffer', 10);

    materialMultiplier += {
      treated_pine: -0.03,
      redwood: 0.08,
      metal: 0.12,
      chain_link: -0.08,
      vinyl: 0.04,
      composite: 0.1,
      cedar: 0,
    }[materialType] ?? 0;

    laborMultiplier += {
      new: 0,
      replacement: 0.08,
      repair: 0.12,
    }[installType] ?? 0;

    quantityMultiplier += quantityBuffer / 100;
    if (height === '8_ft') laborMultiplier += 0.08;
    if (height === 'custom') {
      laborMultiplier += 0.1;
      materialMultiplier += 0.05;
    }

    if (booleanAnswer(answers, 'fenceRemovalRequired', false)) {
      extraItems.push(makeLineItem('q-fence-removal', 'Existing fence removal and disposal allowance', 0, 1850, 420));
    }
    if (booleanAnswer(answers, 'fenceFinishRequired', false)) {
      extraItems.push(makeLineItem('q-fence-finish', 'Fence finish / stain / sealer allowance', 1250, 960));
    }
    if (booleanAnswer(answers, 'fenceGateRequired', false)) {
      extraItems.push(makeLineItem('q-fence-gates', 'Gate fabrication and installation allowance', 1800, 1250));
    }
  }

  if (tradeKey === 'concrete') {
    const strength = stringAnswer(answers, 'concreteStrength', '3000');
    const workType = stringAnswer(answers, 'concreteWorkType', 'slab');
    const reinforcement = stringAnswer(answers, 'concreteReinforcement', 'rebar');
    const finishType = stringAnswer(answers, 'concreteFinishType', 'broom');
    const thickness = stringAnswer(answers, 'concreteThickness', '4_in');

    materialMultiplier += { '2500': -0.03, '3000': 0, '4000': 0.08, custom: 0.12 }[strength] ?? 0;
    laborMultiplier += { slab: 0, footing: 0.06, sidewalk: 0.03, driveway: 0.04, curb: 0.09, patch: 0.1, wall: 0.14 }[workType] ?? 0;
    materialMultiplier += { none: 0, rebar: 0.06, wire_mesh: 0.03 }[reinforcement] ?? 0;
    laborMultiplier += { broom: 0, smooth: 0.02, stamped: 0.12, exposed: 0.14 }[finishType] ?? 0;
    laborMultiplier += { '4_in': 0, '6_in': 0.05, '8_in': 0.1, custom: 0.12 }[thickness] ?? 0;
  }

  if (tradeKey === 'electrical') {
    const primaryMaterial = stringAnswer(answers, 'electricalPrimaryMaterial', 'fixtures');
    const complexity = stringAnswer(answers, 'electricalComplexity', 'medium');
    const phase = stringAnswer(answers, 'electricalInstallationPhase', 'complete_scope');

    materialMultiplier += {
      emt: 0.03,
      pvc: 0,
      mc_cable: 0.01,
      copper_wire: 0.1,
      panelboards: 0.15,
      devices: 0.02,
      fixtures: 0.06,
    }[primaryMaterial] ?? 0;

    laborMultiplier += { low: 0, medium: 0.06, high: 0.14 }[complexity] ?? 0;
    laborMultiplier += { rough_in: 0.03, trim: 0.02, final: 0.01, complete_scope: 0.08 }[phase] ?? 0;

    if (booleanAnswer(answers, 'electricalTestingCloseout', true)) {
      extraItems.push(makeLineItem('q-electrical-closeout', 'Testing, labeling, and closeout allowance', 450, 1250));
      notes.push('Testing, labeling, and closeout carried in the electrical estimate.');
    }
  }

  if (tradeKey === 'plumbing') {
    const pipeType = stringAnswer(answers, 'plumbingPipeType', 'pvc');
    const workType = stringAnswer(answers, 'plumbingWorkType', 'complete_scope');

    materialMultiplier += { pvc: 0, copper: 0.14, pex: 0.03, cast_iron: 0.16, undefined: 0.05 }[pipeType] ?? 0;
    laborMultiplier += { rough_in: 0.04, trim: 0.03, underground: 0.09, above_ceiling: 0.07, complete_scope: 0.1 }[workType] ?? 0;

    if (booleanAnswer(answers, 'plumbingFixturesIncluded', true)) {
      extraItems.push(makeLineItem('q-plumbing-fixtures', 'Fixture trim and connection allowance', 1600, 1180));
    }
    if (booleanAnswer(answers, 'plumbingTestingIncluded', true)) {
      extraItems.push(makeLineItem('q-plumbing-testing', 'Testing and startup allowance', 250, 940));
    }
    if (booleanAnswer(answers, 'plumbingInsulationIncluded', false)) {
      extraItems.push(makeLineItem('q-plumbing-insulation', 'Pipe insulation allowance', 950, 420));
    }
  }

  if (tradeKey === 'masonry') {
    const materialType = stringAnswer(answers, 'masonryMaterialType', 'thin_brick');
    const mortarType = stringAnswer(answers, 'masonryMortarType', 'standard');
    const cleanupScope = stringAnswer(answers, 'masonryCleanupScope', 'standard');

    materialMultiplier += {
      thin_brick: 0,
      full_brick: 0.06,
      cmu: -0.02,
      limestone: 0.16,
      stone_veneer: 0.1,
    }[materialType] ?? 0;
    materialMultiplier += { standard: 0, colored: 0.04, high_performance: 0.09 }[mortarType] ?? 0;
    laborMultiplier += { standard: 0, enhanced: 0.05, premium: 0.1 }[cleanupScope] ?? 0;

    if (booleanAnswer(answers, 'masonryScaffoldRequired', false)) {
      extraItems.push(makeLineItem('q-masonry-scaffold', 'Scaffold / elevated access allowance', 850, 1650, 620));
    }
    if (booleanAnswer(answers, 'masonrySealantIncluded', false)) {
      extraItems.push(makeLineItem('q-masonry-sealant', 'Sealant and waterproofing coordination allowance', 680, 720));
    }
  }

  if (tradeKey === 'doors_hardware') {
    const packageType = stringAnswer(answers, 'doorsPackageType', 'mixed_package');
    const installationBasis = stringAnswer(answers, 'doorsInstallationBasis', 'complete_scope');
    const frameCondition = stringAnswer(answers, 'doorsFrameCondition', 'new_frames');
    const finishCoordination = stringAnswer(answers, 'doorsFinishCoordination', 'standard');

    materialMultiplier += {
      hollow_metal: 0.04,
      wood_doors: 0.07,
      hardware_only: -0.08,
      mixed_package: 0.1,
      specialty_openings: 0.16,
    }[packageType] ?? 0;

    laborMultiplier += {
      supply_install: 0.06,
      install_only: 0.02,
      hardware_only: -0.03,
      complete_scope: 0.1,
    }[installationBasis] ?? 0;

    laborMultiplier += {
      new_frames: 0,
      existing_openings: 0.08,
      mixed_scope: 0.11,
    }[frameCondition] ?? 0;

    laborMultiplier += {
      standard: 0,
      custom_finish: 0.04,
      field_touchup: 0.06,
    }[finishCoordination] ?? 0;

    if (booleanAnswer(answers, 'doorsFireRatedRequired', false)) {
      materialMultiplier += 0.05;
      laborMultiplier += 0.03;
      extraItems.push(makeLineItem('q-doors-labels', 'Fire-rated labels, coordination, and closeout allowance', 620, 740));
    }
  }

  if (tradeKey === 'drywall') {
    const boardType = stringAnswer(answers, 'drywallBoardType', 'standard');
    const finishLevel = stringAnswer(answers, 'drywallFinishLevel', 'level_4');
    const framingCondition = stringAnswer(answers, 'drywallFramingCondition', 'framing_by_others');

    materialMultiplier += {
      standard: 0,
      moisture_resistant: 0.04,
      type_x: 0.08,
      abuse_resistant: 0.11,
      shaft_wall: 0.15,
    }[boardType] ?? 0;

    laborMultiplier += {
      level_2: -0.04,
      level_4: 0,
      level_5: 0.12,
      patch: 0.08,
    }[finishLevel] ?? 0;

    laborMultiplier += {
      framing_by_others: 0,
      existing_framing: 0.06,
      full_assembly: 0.12,
    }[framingCondition] ?? 0;

    if (booleanAnswer(answers, 'drywallInsulationIncluded', false)) {
      extraItems.push(makeLineItem('q-drywall-insulation', 'Insulation coordination allowance', 1350, 880));
    }
    if (booleanAnswer(answers, 'drywallSealantIncluded', false)) {
      extraItems.push(makeLineItem('q-drywall-sealant', 'Acoustical and perimeter sealant allowance', 340, 560));
    }
  }

  if (tradeKey === 'hvac') {
    const primarySystem = stringAnswer(answers, 'hvacPrimarySystem', 'ductwork');
    const installPhase = stringAnswer(answers, 'hvacInstallationPhase', 'complete_scope');
    const insulationBasis = stringAnswer(answers, 'hvacInsulationBasis', 'standard');

    materialMultiplier += {
      ductwork: 0.02,
      rtu: 0.14,
      split_systems: 0.09,
      exhaust_makeup: 0.06,
      piping_controls: 0.11,
    }[primarySystem] ?? 0;

    laborMultiplier += {
      rough_in: 0.04,
      trim: 0.03,
      startup: 0.05,
      complete_scope: 0.1,
    }[installPhase] ?? 0;

    materialMultiplier += {
      standard: 0,
      field_wrap: 0.04,
      double_wall: 0.11,
      none: -0.03,
    }[insulationBasis] ?? 0;

    if (booleanAnswer(answers, 'hvacTestBalanceIncluded', true)) {
      extraItems.push(makeLineItem('q-hvac-tab', 'TAB, startup, and commissioning allowance', 480, 1680));
      notes.push('TAB and startup carried with the HVAC estimate.');
    }
    if (booleanAnswer(answers, 'hvacControlsIncluded', true)) {
      extraItems.push(makeLineItem('q-hvac-controls', 'Controls and integration coordination allowance', 920, 740));
      notes.push('Controls coordination carried in the HVAC estimate.');
    }
  }

  if (tradeKey === 'specialties') {
    const packageType = stringAnswer(answers, 'specialtiesPackageType', 'partitions_accessories');
    const installCondition = stringAnswer(answers, 'specialtiesInstallCondition', 'new_work');

    materialMultiplier += {
      partitions_accessories: 0.03,
      accessories_only: -0.04,
      toilet_partitions: 0.02,
      vertical_transport: 0.18,
      mixed_specialties: 0.09,
    }[packageType] ?? 0;

    laborMultiplier += {
      new_work: 0,
      retrofit: 0.07,
      phased: 0.12,
    }[installCondition] ?? 0;

    if (booleanAnswer(answers, 'specialtiesAnchorageIncluded', true)) {
      extraItems.push(makeLineItem('q-specialties-anchorage', 'Blocking, anchorage, and backing allowance', 460, 620));
    }
    if (booleanAnswer(answers, 'specialtiesCloseoutIncluded', true)) {
      extraItems.push(makeLineItem('q-specialties-closeout', 'Adjustments, punch, and closeout allowance', 140, 540));
    }
  }

  if (tradeKey === 'fire_protection') {
    const systemType = stringAnswer(answers, 'fireProtectionSystemType', 'sprinkler');
    const installPhase = stringAnswer(answers, 'fireProtectionInstallPhase', 'complete_scope');

    materialMultiplier += {
      sprinkler: 0.03,
      standpipe: 0.08,
      fire_pump: 0.16,
      alarm_coordination: 0.04,
      mixed: 0.1,
    }[systemType] ?? 0;

    laborMultiplier += {
      underground: 0.05,
      overhead: 0.08,
      trim: 0.03,
      complete_scope: 0.1,
    }[installPhase] ?? 0;

    if (booleanAnswer(answers, 'fireProtectionSeismicIncluded', true)) {
      extraItems.push(makeLineItem('q-fire-seismic', 'Seismic bracing and support allowance', 760, 920));
    }
    if (booleanAnswer(answers, 'fireProtectionTestingIncluded', true)) {
      extraItems.push(makeLineItem('q-fire-testing', 'Testing, inspections, and turnover allowance', 220, 1240));
      notes.push('Testing and inspection carry applied to the fire protection estimate.');
    }
    if (booleanAnswer(answers, 'fireProtectionDrainFillIncluded', true)) {
      extraItems.push(makeLineItem('q-fire-drain-fill', 'Drain, fill, and final turnover allowance', 160, 680));
    }
  }

  if (tradeKey === 'finishes') {
    const packageType = stringAnswer(answers, 'finishesPackageType', 'painting');
    const substrateCondition = stringAnswer(answers, 'finishesSubstrateCondition', 'ready');

    materialMultiplier += {
      painting: 0,
      flooring: 0.08,
      wallcovering: 0.06,
      epoxy_coatings: 0.1,
      mixed_finishes: 0.09,
    }[packageType] ?? 0;

    laborMultiplier += {
      ready: 0,
      moderate_prep: 0.07,
      heavy_prep: 0.14,
    }[substrateCondition] ?? 0;

    if (booleanAnswer(answers, 'finishesMoistureMitigation', false)) {
      extraItems.push(makeLineItem('q-finishes-moisture', 'Moisture mitigation / primers allowance', 980, 460));
    }
    if (booleanAnswer(answers, 'finishesPremiumFinish', false)) {
      materialMultiplier += 0.04;
      laborMultiplier += 0.06;
      notes.push('Premium finish level carried in the architectural finishes estimate.');
    }
  }

  if (tradeKey === 'steel') {
    const packageType = stringAnswer(answers, 'steelPackageType', 'structural_frame');
    const connectionComplexity = stringAnswer(answers, 'steelConnectionComplexity', 'standard');
    const coatingType = stringAnswer(answers, 'steelCoatingType', 'primer');
    const erectionPhase = stringAnswer(answers, 'steelErectionPhase', 'standard');

    materialMultiplier += {
      structural_frame: 0.05,
      misc_steel: 0.01,
      stairs_rails: 0.07,
      deck_joists: 0.04,
      mixed_steel: 0.09,
    }[packageType] ?? 0;

    laborMultiplier += {
      standard: 0,
      moment: 0.08,
      heavy: 0.14,
    }[connectionComplexity] ?? 0;

    materialMultiplier += {
      primer: 0,
      galvanized: 0.09,
      intumescent: 0.16,
      none: -0.03,
    }[coatingType] ?? 0;

    laborMultiplier += {
      standard: 0,
      phased: 0.07,
      congested: 0.13,
    }[erectionPhase] ?? 0;
  }

  if (tradeKey === 'roofing') {
    const systemType = stringAnswer(answers, 'roofingSystemType', 'tpo');
    const insulationBasis = stringAnswer(answers, 'roofingInsulationBasis', 'standard');
    const flashingComplexity = stringAnswer(answers, 'roofingFlashingComplexity', 'standard');

    materialMultiplier += {
      tpo: 0.01,
      pvc: 0.06,
      modified_bitumen: 0.08,
      metal_roof: 0.14,
      waterproofing: 0.1,
    }[systemType] ?? 0;

    materialMultiplier += {
      standard: 0,
      tapered: 0.07,
      high_r: 0.09,
      recover: 0.03,
    }[insulationBasis] ?? 0;

    laborMultiplier += {
      standard: 0,
      enhanced: 0.06,
      intensive: 0.12,
    }[flashingComplexity] ?? 0;

    if (booleanAnswer(answers, 'roofingTearoffRequired', false)) {
      extraItems.push(makeLineItem('q-roofing-tearoff', 'Roof tear-off, haul-off, and protection allowance', 0, 2240, 840));
    }
  }

  if (tradeKey === 'glazing') {
    const systemType = stringAnswer(answers, 'glazingSystemType', 'storefront');
    const performanceLevel = stringAnswer(answers, 'glazingPerformanceLevel', 'standard');
    const installCondition = stringAnswer(answers, 'glazingInstallCondition', 'new_opening');

    materialMultiplier += {
      storefront: 0.04,
      curtain_wall: 0.16,
      windows: 0.06,
      mirrors: -0.02,
      mixed_glazing: 0.1,
    }[systemType] ?? 0;

    materialMultiplier += {
      standard: 0,
      thermal: 0.05,
      impact: 0.11,
      specialty: 0.14,
    }[performanceLevel] ?? 0;

    laborMultiplier += {
      new_opening: 0,
      retrofit: 0.09,
      phased: 0.12,
    }[installCondition] ?? 0;

    if (booleanAnswer(answers, 'glazingHardwareIncluded', true)) {
      extraItems.push(makeLineItem('q-glazing-hardware', 'Hardware, film, and glazing closeout allowance', 620, 540));
    }
  }

  if (tradeKey === 'civil') {
    const packageType = stringAnswer(answers, 'civilPackageType', 'earthwork');
    const haulCondition = stringAnswer(answers, 'civilHaulCondition', 'onsite');

    materialMultiplier += {
      earthwork: 0,
      utilities: 0.06,
      paving: 0.08,
      site_concrete: 0.05,
      mixed_site: 0.09,
    }[packageType] ?? 0;

    laborMultiplier += {
      onsite: 0,
      import_export: 0.08,
      offhaul: 0.12,
    }[haulCondition] ?? 0;

    if (booleanAnswer(answers, 'civilTrafficControl', false)) {
      extraItems.push(makeLineItem('q-civil-traffic', 'Traffic control / MOT allowance', 0, 1280, 320));
    }
    if (booleanAnswer(answers, 'civilDewatering', false)) {
      extraItems.push(makeLineItem('q-civil-dewatering', 'Dewatering and water management allowance', 240, 980, 460));
    }
  }

  const pricingUnitValue = [
    stringAnswer(answers, 'fenceMaterialPricingUnit'),
    stringAnswer(answers, 'concretePricingUnit'),
    stringAnswer(answers, 'electricalMaterialPricingUnit'),
    stringAnswer(answers, 'plumbingMaterialUnit'),
    stringAnswer(answers, 'masonryPricingUnit'),
    stringAnswer(answers, 'doorsPricingUnit'),
    stringAnswer(answers, 'drywallPricingUnit'),
    stringAnswer(answers, 'hvacPricingUnit'),
    stringAnswer(answers, 'specialtiesPricingUnit'),
    stringAnswer(answers, 'fireProtectionPricingUnit'),
    stringAnswer(answers, 'finishesPricingUnit'),
    stringAnswer(answers, 'steelPricingUnit'),
    stringAnswer(answers, 'roofingPricingUnit'),
    stringAnswer(answers, 'glazingPricingUnit'),
    stringAnswer(answers, 'civilPricingUnit'),
    stringAnswer(answers, 'genericMaterialBasis', 'project'),
  ].find(Boolean) || 'project';

  const materialUnitLabel = resolvePricingUnitLabel(pricingUnitValue);
  const laborModelLabel = resolveLaborModelLabel(laborPricingModel);

  const selectionAnswerLookup: Record<string, string> = {};
  for (const section of template.sections) {
    for (const question of section.questions) {
      selectionAnswerLookup[question.id] = getQuestionLabelValue(question, answers);
    }
  }

  const pricingFields: QuestionnairePricingField[] = [
    { label: 'Material unit', value: materialUnitLabel },
    { label: 'Labor basis', value: laborModelLabel },
    { label: 'Waste factor', value: `${wastePercent}%` },
    { label: 'Material markup', value: `${materialMarkupPercent}%` },
    { label: 'Contingency', value: `${contingencyPercent}%` },
    { label: 'Tax', value: `${taxPercent}%` },
  ];

  return {
    materialMultiplier,
    laborMultiplier,
    equipmentMultiplier,
    quantityMultiplier,
    contingencyPercent,
    taxPercent,
    notes,
    pricingFields,
    materialUnitLabel,
    laborModelLabel,
    extraItems,
    selectionAnswerLookup,
  };
}

export function buildQuestionnairePresentation(input: {
  state: EstimateQuestionnaireState;
  resultCostItems: EstimateCostItem[];
  profile: AdjustmentProfile;
}): QuestionnairePresentation {
  const template = getQuestionnaireTemplateByKey(input.state.templateId);
  const blocks = buildSelectionBlocks(input.state.tradeKey, template.sections, input.state.answers, input.resultCostItems);
  const notes = [
    ...input.profile.notes,
    `Material carry based on ${input.profile.materialUnitLabel.toLowerCase()}.`,
    `Labor carried on a ${input.profile.laborModelLabel.toLowerCase()} basis.`,
  ];

  return {
    sectionTitle: `${input.state.tradeLabel} Estimating Questionnaire`,
    selectionBlocks: blocks,
    pricingFields: input.profile.pricingFields,
    notes: [...new Set(notes)],
  };
}
