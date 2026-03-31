import type { EstimateType } from '@/lib/estimate';

export function buildEstimateDraftsPrompt(input: {
  projectName: string;
  client: string;
  location: string;
  trade: string;
  bidDueDate: string;
  probableScope: string;
  keyDocuments: string[];
  keySpecs: string[];
  inclusions: string[];
  exclusions: string[];
  risks: string[];
  rfis: string[];
  materials: string[];
  timeEstimate: string;
  weatherImpact: string;
  proposalReqs: string[];
  scheduleConstraints: string[];
}) {
  return `You are a senior construction estimator preparing polished commercial estimate drafts.

Build two estimate packages from the project intelligence below:
1. TRADE ESTIMATE
2. GLOBAL BUDGETARY ESTIMATE

Strict client-facing rules:
- Use professional construction estimating language.
- Do NOT use weak phrases like "appears to be".
- Do NOT mention AI, confidence percentages, inference language, extracted text, or system reasoning in client-facing content.
- Move uncertainty into assumptions, qualifications, clarifications, exclusions, and proposal notes.
- The client-facing executive summary must sound commercial, direct, and business-ready.
- The global version must read as a budgetary estimate / preliminary global analysis and clearly state that it is not for contract use without detailed takeoff and review.

PROJECT INTELLIGENCE
Project Name: ${input.projectName}
Client / GC: ${input.client}
Location: ${input.location}
Trade: ${input.trade}
Bid Due Date: ${input.bidDueDate}

Probable Scope:
${input.probableScope}

Key Documents:
${input.keyDocuments.map((item) => `- ${item}`).join('\n') || '- Not available'}

Key Plans and Specs:
${input.keySpecs.map((item) => `- ${item}`).join('\n') || '- Not available'}

Inclusions:
${input.inclusions.map((item) => `- ${item}`).join('\n') || '- Not available'}

Exclusions:
${input.exclusions.map((item) => `- ${item}`).join('\n') || '- Not available'}

Risks:
${input.risks.map((item) => `- ${item}`).join('\n') || '- Not available'}

RFIs:
${input.rfis.map((item) => `- ${item}`).join('\n') || '- Not available'}

Materials:
${input.materials.map((item) => `- ${item}`).join('\n') || '- Not available'}

Time Estimate:
${input.timeEstimate}

Weather Impact:
${input.weatherImpact}

Proposal Requirements:
${input.proposalReqs.map((item) => `- ${item}`).join('\n') || '- Not available'}

Schedule Constraints:
${input.scheduleConstraints.map((item) => `- ${item}`).join('\n') || '- Not available'}

For EACH estimate draft return:
- title
- executiveSummary
- scopeOfWork
- inclusions
- exclusions
- clarifications
- qualifications
- proposalNotes
- keyDocuments
- keyPlansAndSpecs
- costItems
- pricingSummary
- internalAssumptions
- internalInferredData
- internalTechnicalBacking
- internalAnalysisNotes
- internalReviewComments
- clientDisclaimer
- internalDisclaimer

Cost item rules:
- Create a realistic, business-ready budget structure.
- Use clean line items, not vague placeholders.
- Use quantity, unit, materialCost, laborCost, equipmentCost, subcontractCost, subtotal.
- Ensure subtotals and final total math are consistent.
- For trade estimate, structure pricing around the trade scope.
- For global estimate, structure pricing around major disciplines or budget buckets.
- Keep the global estimate clearly marked as budgetary.

Return valid JSON only with this shape:
{
  "trade": {
    "title": "...",
    "executiveSummary": "...",
    "scopeOfWork": "...",
    "inclusions": ["..."],
    "exclusions": ["..."],
    "clarifications": ["..."],
    "qualifications": ["..."],
    "proposalNotes": ["..."],
    "keyDocuments": ["..."],
    "keyPlansAndSpecs": ["..."],
    "costItems": [
      {
        "id": "item-1",
        "section": "...",
        "description": "...",
        "quantity": 1,
        "unit": "LS",
        "materialCost": 0,
        "laborCost": 0,
        "equipmentCost": 0,
        "subcontractCost": 0,
        "subtotal": 0,
        "notes": "..."
      }
    ],
    "pricingSummary": {
      "directSubtotal": 0,
      "overheadPercent": 8,
      "overheadAmount": 0,
      "profitPercent": 5,
      "profitAmount": 0,
      "contingencyPercent": 3,
      "contingencyAmount": 0,
      "bondPercent": 0,
      "bondAmount": 0,
      "taxPercent": 0,
      "taxAmount": 0,
      "total": 0,
      "validityDays": 30,
      "budgetary": false,
      "proposalLabel": "Trade Estimate"
    },
    "internalAssumptions": ["..."],
    "internalInferredData": ["..."],
    "internalTechnicalBacking": ["..."],
    "internalAnalysisNotes": ["..."],
    "internalReviewComments": ["..."],
    "clientDisclaimer": "...",
    "internalDisclaimer": "..."
  },
  "global": {
    "title": "...",
    "executiveSummary": "...",
    "scopeOfWork": "...",
    "inclusions": ["..."],
    "exclusions": ["..."],
    "clarifications": ["..."],
    "qualifications": ["..."],
    "proposalNotes": ["..."],
    "keyDocuments": ["..."],
    "keyPlansAndSpecs": ["..."],
    "costItems": [
      {
        "id": "item-1",
        "section": "...",
        "description": "...",
        "quantity": 1,
        "unit": "LS",
        "materialCost": 0,
        "laborCost": 0,
        "equipmentCost": 0,
        "subcontractCost": 0,
        "subtotal": 0,
        "notes": "..."
      }
    ],
    "pricingSummary": {
      "directSubtotal": 0,
      "overheadPercent": 8,
      "overheadAmount": 0,
      "profitPercent": 5,
      "profitAmount": 0,
      "contingencyPercent": 5,
      "contingencyAmount": 0,
      "bondPercent": 0,
      "bondAmount": 0,
      "taxPercent": 0,
      "taxAmount": 0,
      "total": 0,
      "validityDays": 30,
      "budgetary": true,
      "proposalLabel": "Budgetary Estimate"
    },
    "internalAssumptions": ["..."],
    "internalInferredData": ["..."],
    "internalTechnicalBacking": ["..."],
    "internalAnalysisNotes": ["..."],
    "internalReviewComments": ["..."],
    "clientDisclaimer": "...",
    "internalDisclaimer": "..."
  }
}

Do not include markdown fences. Do not include commentary outside JSON.`;
}

export function buildEstimateDeliveryNotificationSubject(projectName: string, estimateNumber: string) {
  return `Estimate opened: ${estimateNumber} ${projectName}`;
}

export function getEstimateDisplayLabel(type: EstimateType) {
  return type === 'global' ? 'Budgetary Estimate' : 'Trade Estimate';
}
