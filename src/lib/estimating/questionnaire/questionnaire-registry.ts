import { COMMON_QUESTIONNAIRE_SECTIONS } from '@/lib/estimating/questionnaire/questionnaire-common';
import { concreteQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-concrete';
import { fireProtectionQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-fire-protection';
import { doorsHardwareQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-doors-hardware';
import { drywallQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-drywall';
import { electricalQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-electrical';
import { fenceQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-fence';
import { finishesQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-finishes';
import { genericQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-generic';
import { glassGlazingQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-glass-glazing';
import { hvacQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-hvac';
import { masonryQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-masonry';
import { plumbingQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-plumbing';
import { roofingQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-roofing';
import { siteWorkQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-site-work';
import { specialtiesQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-specialties';
import { steelQuestionnaireTemplate } from '@/lib/estimating/questionnaire/questionnaire-steel';
import type { QuestionnaireTemplate, TradeQuestionnaireKey } from '@/lib/estimating/questionnaire/questionnaire-types';

const baseTemplates: Record<TradeQuestionnaireKey, QuestionnaireTemplate> = {
  generic: genericQuestionnaireTemplate,
  fence: fenceQuestionnaireTemplate,
  concrete: concreteQuestionnaireTemplate,
  masonry: masonryQuestionnaireTemplate,
  electrical: electricalQuestionnaireTemplate,
  plumbing: plumbingQuestionnaireTemplate,
  doors_hardware: doorsHardwareQuestionnaireTemplate,
  drywall: drywallQuestionnaireTemplate,
  hvac: hvacQuestionnaireTemplate,
  specialties: specialtiesQuestionnaireTemplate,
  fire_protection: fireProtectionQuestionnaireTemplate,
  finishes: finishesQuestionnaireTemplate,
  steel: steelQuestionnaireTemplate,
  roofing: roofingQuestionnaireTemplate,
  glazing: glassGlazingQuestionnaireTemplate,
  civil: siteWorkQuestionnaireTemplate,
};

function mergeCommonSections(template: QuestionnaireTemplate): QuestionnaireTemplate {
  return {
    ...template,
    sections: [...template.sections, ...COMMON_QUESTIONNAIRE_SECTIONS],
  };
}

export const questionnaireRegistry: Record<TradeQuestionnaireKey, QuestionnaireTemplate> = {
  generic: mergeCommonSections(baseTemplates.generic),
  fence: mergeCommonSections(baseTemplates.fence),
  concrete: mergeCommonSections(baseTemplates.concrete),
  masonry: mergeCommonSections(baseTemplates.masonry),
  electrical: mergeCommonSections(baseTemplates.electrical),
  plumbing: mergeCommonSections(baseTemplates.plumbing),
  doors_hardware: mergeCommonSections(baseTemplates.doors_hardware),
  drywall: mergeCommonSections(baseTemplates.drywall),
  hvac: mergeCommonSections(baseTemplates.hvac),
  specialties: mergeCommonSections(baseTemplates.specialties),
  fire_protection: mergeCommonSections(baseTemplates.fire_protection),
  finishes: mergeCommonSections(baseTemplates.finishes),
  steel: mergeCommonSections(baseTemplates.steel),
  roofing: mergeCommonSections(baseTemplates.roofing),
  glazing: mergeCommonSections(baseTemplates.glazing),
  civil: mergeCommonSections(baseTemplates.civil),
};

export function normalizeTradeToQuestionnaireKey(trade: string | null | undefined): TradeQuestionnaireKey {
  const normalized = trade?.trim().toLowerCase() || '';
  if (!normalized) return 'generic';
  if (/(fence|fencing|gate)/.test(normalized)) return 'fence';
  if (/(concrete|cement|flatwork)/.test(normalized)) return 'concrete';
  if (/(masonry|brick|stone|block|cmu|veneer)/.test(normalized)) return 'masonry';
  if (/(door|frame|hardware|hollow metal|openings)/.test(normalized)) return 'doors_hardware';
  if (/(toilet partition|bathroom partition|restroom partition|bathroom accessor(?:y|ies)|restroom accessor(?:y|ies)|grab bar|mirror|soap dispenser|paper towel|hand dryer|elevator|lift|vertical transport)/.test(normalized)) return 'specialties';
  if (/(drywall|gypsum|gyp|sheetrock|framing and drywall)/.test(normalized)) return 'drywall';
  if (/(hvac|mechanical|duct|rtu|air handling|air balance|ventilation)/.test(normalized)) return 'hvac';
  if (/(electrical|electric|power|lighting|low voltage)/.test(normalized)) return 'electrical';
  if (/(fire protection|fire sprinkler|fire alarm|fire suppression|standpipe|fire pump)/.test(normalized)) return 'fire_protection';
  if (/(painting|coating|stain|sealer|primer|flooring|tile|carpet|vinyl|laminate|epoxy floor|wall covering|wallpaper)/.test(normalized)) return 'finishes';
  if (/(plumbing|plumb|piping|pipe|domestic water|waste)/.test(normalized)) return 'plumbing';
  if (/(structural steel|steel|beam|column|joist|metal deck|truss|bracing)/.test(normalized)) return 'steel';
  if (/(roof|roofing|shingle|membrane|flashing|gutter|downspout|waterproofing)/.test(normalized)) return 'roofing';
  if (/(glass|glazing|window|storefront|curtain wall|skylight|laminated|tempered)/.test(normalized)) return 'glazing';
  if (/(site work|civil|grading|excavation|landscape|storm drain|utility|retaining wall|septic|paving)/.test(normalized)) return 'civil';
  return 'generic';
}

export function getQuestionnaireTemplateByKey(key: TradeQuestionnaireKey): QuestionnaireTemplate {
  return questionnaireRegistry[key] || questionnaireRegistry.generic;
}
