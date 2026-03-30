export function buildClassificationPrompt(fileContent: string, fileName: string, tradeKeywords: string[]): string {
  return `You are a construction document classification expert. Analyze the following document content and classify it.

File name: ${fileName}

Document content (first 3000 chars):
${fileContent.slice(0, 3000)}

Trade keywords for relevance: ${tradeKeywords.join(', ')}

Classify this document into ONE of these categories:
- drawings: Construction drawings, plans, blueprints, floor plans, elevations, sections, details, schedules
- addenda: Addenda, amendments, supplements to the project
- specifications: Project manual, specifications, technical requirements, Divisions 01-49
- civil: Civil engineering, site plans, grading, drainage, utilities
- structural: Structural drawings, calculations, steel, concrete design
- architectural: Architectural drawings, floor plans, elevations, finishes
- mep: Mechanical, Electrical, Plumbing drawings and specs
- site: Site work, landscaping, parking, paving
- geotech: Geotechnical reports, soil analysis, borings
- fire_protection: Fire sprinkler, alarm, suppression systems
- bid_forms: Bid forms, instructions to bidders, proposal forms
- rfi: RFI responses, submittals, clarification letters
- irrelevant: Marketing materials, unrelated content, duplicates

Also provide:
1. A brief summary (1-2 sentences) of what the document contains
2. Key terms and keywords found
3. Whether this document is relevant to the trade (based on trade keywords)
4. If relevant, what specific sections/sheets should be reviewed

Respond in JSON format:
{
  "category": "<category>",
  "confidence": 0.0-1.0,
  "summary": "...",
  "keywords": ["..."],
  "relevantToTrade": true/false,
  "reason": "...",
  "sheetReferences": [{"number": "...", "title": "..."}]
}

Return valid JSON only. Do not wrap the response in Markdown fences.`;
}

export function buildScopeAnalysisPrompt(
  projectMetadata: string,
  classifiedDocs: string,
  trade: string,
  tradeKeywords: string[]
): string {
  return `You are a pre-construction estimation expert for the trade: "${trade}".

PROJECT INFORMATION:
${projectMetadata}

CLASSIFIED DOCUMENTS:
${classifiedDocs}

TRADE KEYWORDS: ${tradeKeywords.join(', ')}

Analyze the bid package and determine:

1. PROBABLE SCOPE: What specific work items does this trade need to perform? Be specific about quantities where visible, materials, installation requirements, and any special conditions.

2. PRIORITY DOCUMENTS: Which documents are most critical for this trade? Rank them.

3. KEY SHEETS: Which drawing sheets are most relevant? List sheet numbers and titles.

4. KEY SPECIFICATIONS: What specification sections apply? List division and section numbers.

5. INCLUSIONS: What is clearly included in the scope?

6. EXCLUSIONS: What is NOT included or explicitly excluded?

7. RISKS: What risks, ambiguities, or missing information could impact the estimate?

8. RFIs SUGGESTED: What questions should be asked before bidding?

9. ALTERNATES & ALLOWANCES: Any alternates or allowances mentioned?

10. MATERIALS: What materials are specified or implied?

11. CONDITIONS: Any special site conditions, schedule constraints, or access issues?

Respond in JSON format:
{
  "probableScope": "detailed scope description",
  "confidence": 0.0-1.0,
  "priorityDocs": ["file descriptions ranked by priority"],
  "keySheets": [{"number": "...", "title": "...", "relevance": "..."}],
  "keySpecs": ["section references"],
  "inclusions": ["..."],
  "exclusions": ["..."],
  "risks": [{"id": "r1", "category": "...", "description": "...", "severity": "low|medium|high|critical", "likelihood": "unlikely|possible|likely|very_likely", "impact": "...", "mitigation": "...", "source": "extracted|inferred"}],
  "rfis": [{"id": "rfi1", "question": "...", "reason": "...", "referenceDoc": "...", "referenceSheet": "...", "priority": "low|medium|high", "category": "..."}],
  "alternates": [{"description": "...", "estimatedValue": 0}],
  "allowances": [{"description": "...", "estimatedValue": 0, "unit": "...", "quantity": 0}],
  "materials": [{"name": "...", "category": "...", "estimatedQty": 0, "unit": "...", "notes": "..."}],
  "scheduleConstraints": ["..."],
  "insuranceReqs": ["..."],
  "proposalReqs": ["..."],
  "assumptions": ["..."]
}

Return valid JSON only. Do not wrap the response in Markdown fences.`;
}

export function buildExecutiveSummaryPrompt(analysis: string): string {
  return `You are a pre-construction assistant. Based on the following analysis of a construction bid package, generate a clear, concise executive summary that a subcontractor can quickly review.

ANALYSIS DATA:
${analysis}

Generate an executive summary that covers:
1. Project overview (name, location, size, client)
2. Trade and probable scope
3. Key documents and sheets to review
4. Important dates
5. Materials detected
6. Top risks
7. Suggested RFIs (top 5 most important)
8. Time estimate
9. Weather impact considerations
10. Next steps for the estimator

Write in a professional but accessible tone. Use bullet points and short sentences. A construction estimator should be able to read this in 2-3 minutes and know exactly what to do next.

Respond in JSON format:
{
  "project": "...",
  "client": "...",
  "location": "...",
  "trade": "...",
  "probableScope": "...",
  "totalFiles": 0,
  "relevantFiles": 0,
  "keyDocuments": ["..."],
  "keySheets": [{"sheetNumber": "...", "sheetTitle": "...", "fileName": "...", "reason": "...", "elements": ["..."], "scopeRelation": "...", "confidence": 0.0}],
  "importantDates": [{"label": "...", "date": "..."}],
  "materialsDetected": [{"name": "...", "category": "...", "estimatedQty": 0, "unit": "...", "notes": "..."}],
  "risks": [{"id": "...", "category": "...", "description": "...", "severity": "...", "likelihood": "...", "impact": "...", "mitigation": "...", "source": "..."}],
  "rfis": [{"id": "...", "question": "...", "reason": "...", "referenceDoc": "...", "priority": "...", "category": "..."}],
  "timeEstimate": {"totalHours": 0, "totalDays": 0, "crewSize": 0, "phases": [{"name": "...", "hours": 0, "days": 0, "crew": 0, "description": "..."}], "risks": ["..."], "assumptions": ["..."]},
  "weatherImpact": {"impactSummary": "...", "workImpact": ["..."], "logisticsImpact": ["..."]},
  "nextSteps": ["..."],
  "confidence": 0.0,
  "inclusions": ["..."],
  "exclusions": ["..."]
}

Return valid JSON only. Do not wrap the response in Markdown fences.`;
}

export function buildTimeEstimatePrompt(
  trade: string,
  scope: string,
  materials: string,
  projectSize: string,
  weatherImpact: string
): string {
  return `You are a construction scheduling expert. Estimate the labor time needed for the following scope:

TRADE: ${trade}
SCOPE: ${scope}
MATERIALS: ${materials}
PROJECT SIZE: ${projectSize}
WEATHER CONDITIONS: ${weatherImpact}

Provide a realistic labor estimate with:
1. Total hours and days
2. Suggested crew size
3. Work phases with breakdown
4. Risks that could increase time
5. Assumptions made

Be conservative - it's better to overestimate than underestimate for bidding purposes.

Respond in JSON format:
{
  "totalHours": 0,
  "totalDays": 0,
  "crewSize": 0,
  "phases": [{"name": "...", "hours": 0, "days": 0, "crew": 0, "description": "..."}],
  "risks": ["..."],
  "assumptions": ["..."]
}

Return valid JSON only. Do not wrap the response in Markdown fences.`;
}

export function buildMetadataExtractionPrompt(fileContent: string, fileName: string): string {
  return `Extract project metadata from this construction document. Look for:

- Project name
- Client / GC / contact name / email
- Bid due date
- RFI due date
- Address / city / state / zip
- Project size (sq ft, acres, etc.)
- Trade names mentioned
- Scope descriptions
- Proposal requirements
- Insurance/bond requirements

File: ${fileName}

Content:
${fileContent.slice(0, 5000)}

Respond in JSON format with only the fields you can confidently extract. Use null for fields not found:
{
  "projectName": null,
  "client": null,
  "contact": null,
  "email": null,
  "bidDueDate": null,
  "rfiDueDate": null,
  "address": null,
  "city": null,
  "state": null,
  "zipCode": null,
  "projectSize": null,
  "trade": null,
  "scopeHints": [],
  "proposalReqs": [],
  "insuranceReqs": [],
  "scheduleConstraints": []
}

Return valid JSON only. Do not wrap the response in Markdown fences.`;
}
