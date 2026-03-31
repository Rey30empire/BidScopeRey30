export type ExtractedMetadata = Partial<{
  projectName: string;
  client: string;
  contact: string;
  email: string;
  bidDueDate: string;
  rfiDueDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  projectSize: string;
  trade: string;
  scopeHints: string[];
  proposalReqs: string[];
  insuranceReqs: string[];
  scheduleConstraints: string[];
}>;

export type MetadataDocumentInput = {
  fileName: string;
  content: string;
};

type Candidate = {
  value: string;
  score: number;
};

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const DATE_VALUE_REGEX = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm)?(?:\s*[a-z]{2,4})?)?|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i;
const STREET_REGEX = /\b\d{2,6}\s+[A-Za-z0-9.'#\- ]+\b(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Trail|Trl|Highway|Hwy|Freeway|Fwy|Parkway|Pkwy|Loop|Terrace|Ter)\b\.?/i;
const CITY_STATE_ZIP_REGEX = /\b([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/;
const PROJECT_SIZE_REGEX = /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|square feet|sf|acres?)\b/i;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function pushCandidate(map: Map<string, Candidate[]>, field: string, value: string | null | undefined, score: number) {
  const normalized = normalizeWhitespace(String(value || ''));
  const minimumLength = field === 'state' ? 2 : 3;
  if (!normalized || normalized.length < minimumLength || normalized.length > 180) {
    return;
  }

  const bucket = map.get(field) ?? [];
  bucket.push({ value: normalized, score });
  map.set(field, bucket);
}

function pickBestCandidate(map: Map<string, Candidate[]>, field: string) {
  const candidates = map.get(field) ?? [];
  if (!candidates.length) {
    return undefined;
  }

  return [...candidates]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.value.length !== left.value.length) {
        return right.value.length - left.value.length;
      }
      return left.value.localeCompare(right.value);
    })[0]?.value;
}

function sanitizeClientName(value: string) {
  return normalizeWhitespace(
    value
      .replace(EMAIL_REGEX, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+-\s+[A-Z][A-Za-z.' -]+$/, '')
  );
}

function sanitizeContactName(value: string) {
  return normalizeWhitespace(
    value
      .replace(EMAIL_REGEX, '')
      .replace(/[<(].*$/, '')
      .replace(/\b(?:phone|cell|office)\b.*$/i, '')
  );
}

function sanitizeTradeName(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^\(s\)\s*[:\-]?\s*/i, '')
      .replace(/^name(?:\(s\))?\s*[:\-]?\s*/i, '')
  );
}

function extractDateCandidate(value: string) {
  const match = value.match(DATE_VALUE_REGEX);
  return match?.[1] ? normalizeWhitespace(match[1]) : undefined;
}

function extractLineValue(line: string, nextLine: string | undefined, pattern: RegExp) {
  const match = line.match(pattern);
  if (!match) {
    return undefined;
  }

  const direct = normalizeWhitespace(match[1] || '');
  if (direct) {
    return direct;
  }

  return nextLine ? normalizeWhitespace(nextLine) : undefined;
}

function extractNameBeforeEmail(line: string) {
  const emailMatch = line.match(EMAIL_REGEX);
  if (!emailMatch) {
    return undefined;
  }

  const prefix = normalizeWhitespace(line.slice(0, emailMatch.index));
  if (!prefix || prefix.length < 4) {
    return undefined;
  }

  const pieces = prefix.split(/[,|/]/).map((item) => normalizeWhitespace(item)).filter(Boolean);
  const candidate = pieces.at(-1);
  if (!candidate || candidate.length < 4 || /\b(?:client|email|contact)\b/i.test(candidate)) {
    return undefined;
  }

  return candidate;
}

function collectArraySignals(lines: string[], keywords: RegExp[]) {
  const values: string[] = [];
  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!normalized || normalized.length > 180) {
      continue;
    }
    if (keywords.some((pattern) => pattern.test(normalized))) {
      values.push(normalized);
    }
  }
  return [...new Set(values)].slice(0, 8);
}

export function extractHeuristicMetadataFromDocuments(documents: MetadataDocumentInput[]): ExtractedMetadata {
  const candidates = new Map<string, Candidate[]>();
  const allLines: string[] = [];

  for (const document of documents) {
    const lines = document.content
      .split(/\r?\n/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)
      .slice(0, 260);

    allLines.push(...lines);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nextLine = lines[index + 1];

      const projectName = extractLineValue(line, nextLine, /^(?:project(?: name)?|job name)\s*[:\-]?\s*(.*)$/i);
      if (projectName && !/^(?:information|overview|details)$/i.test(projectName)) {
        pushCandidate(candidates, 'projectName', projectName, 95);
      }

      const clientValue = extractLineValue(
        line,
        nextLine,
        /^(?:client|gc|general contractor|construction manager|contractor|owner|bid to)\s*[:\-]?\s*(.*)$/i,
      );
      if (clientValue) {
        pushCandidate(candidates, 'client', sanitizeClientName(clientValue), 96);

        const parentheticalContact = clientValue.match(/\(([^)]+)\)/)?.[1];
        if (parentheticalContact) {
          pushCandidate(candidates, 'contact', sanitizeContactName(parentheticalContact), 86);
        }
      }

      const contactValue = extractLineValue(line, nextLine, /^(?:contact|attention|attn|estimator|invited by)\s*[:\-]?\s*(.*)$/i);
      if (contactValue) {
        pushCandidate(candidates, 'contact', sanitizeContactName(contactValue), 90);
      }

      const labeledEmail = extractLineValue(line, nextLine, /^(?:email|e-mail)\s*[:\-]?\s*(.*)$/i);
      if (labeledEmail) {
        pushCandidate(candidates, 'email', labeledEmail.match(EMAIL_REGEX)?.[0], 98);
      }

      const bidDueLine = extractLineValue(
        line,
        nextLine,
        /^(?:bid due(?: date)?|bids due|proposal due(?: date)?|bid date|due date)\s*[:\-]?\s*(.*)$/i,
      );
      if (bidDueLine && !/\brfi\b/i.test(line)) {
        pushCandidate(candidates, 'bidDueDate', extractDateCandidate(bidDueLine), 96);
      }

      const rfiDueLine = extractLineValue(
        line,
        nextLine,
        /^(?:rfi(?:s)? due(?: date)?|questions due(?: date)?)\s*[:\-]?\s*(.*)$/i,
      );
      if (rfiDueLine) {
        pushCandidate(candidates, 'rfiDueDate', extractDateCandidate(rfiDueLine), 96);
      }

      const addressLine = extractLineValue(
        line,
        nextLine,
        /^(?:address|location|project address|site address)\s*[:\-]?\s*(.*)$/i,
      );
      const addressCandidate = addressLine || line.match(STREET_REGEX)?.[0];
      if (addressCandidate) {
        pushCandidate(candidates, 'address', addressCandidate, addressLine ? 90 : 70);
      }

      const cityStateZipSource = addressLine || line;
      const cityStateZip = cityStateZipSource.match(CITY_STATE_ZIP_REGEX);
      if (cityStateZip) {
        const locationScore = addressLine ? 96 : 88;
        pushCandidate(candidates, 'city', cityStateZip[1], locationScore);
        pushCandidate(candidates, 'state', cityStateZip[2], locationScore);
        pushCandidate(candidates, 'zipCode', cityStateZip[3], locationScore);
      }

      const projectSizeValue = extractLineValue(
        line,
        nextLine,
        /^(?:project size|building area|area|square footage)\s*[:\-]?\s*(.*)$/i,
      );
      if (projectSizeValue) {
        pushCandidate(candidates, 'projectSize', projectSizeValue.match(PROJECT_SIZE_REGEX)?.[0] || projectSizeValue, 85);
      } else {
        const projectSizeMatch = line.match(PROJECT_SIZE_REGEX)?.[0];
        if (projectSizeMatch) {
          pushCandidate(candidates, 'projectSize', projectSizeMatch, 60);
        }
      }

      const tradeValue = extractLineValue(
        line,
        nextLine,
        /^(?:trade(?:\s+name(?:\(s\))?)?|discipline|scope trade)\s*[:\-]?\s*(.*)$/i,
      );
      if (tradeValue && tradeValue.length < 80) {
        pushCandidate(candidates, 'trade', sanitizeTradeName(tradeValue), 82);
      }

      const emailMatch = line.match(EMAIL_REGEX)?.[0];
      if (emailMatch) {
        pushCandidate(candidates, 'email', emailMatch, 92);
        pushCandidate(candidates, 'contact', extractNameBeforeEmail(line), 76);
      }
    }
  }

  return {
    projectName: pickBestCandidate(candidates, 'projectName'),
    client: pickBestCandidate(candidates, 'client'),
    contact: pickBestCandidate(candidates, 'contact'),
    email: pickBestCandidate(candidates, 'email'),
    bidDueDate: pickBestCandidate(candidates, 'bidDueDate'),
    rfiDueDate: pickBestCandidate(candidates, 'rfiDueDate'),
    address: pickBestCandidate(candidates, 'address'),
    city: pickBestCandidate(candidates, 'city'),
    state: pickBestCandidate(candidates, 'state'),
    zipCode: pickBestCandidate(candidates, 'zipCode'),
    projectSize: pickBestCandidate(candidates, 'projectSize'),
    trade: pickBestCandidate(candidates, 'trade'),
    scopeHints: collectArraySignals(allLines, [/\bscope\b/i, /\bincludes\b/i, /\bwork includes\b/i]),
    proposalReqs: collectArraySignals(allLines, [/\bbid form\b/i, /\bproposal\b/i, /\battach(?:ments)?\b/i, /\blog bid\b/i]),
    insuranceReqs: collectArraySignals(allLines, [/\binsurance\b/i, /\bbond\b/i, /\bbonding\b/i]),
    scheduleConstraints: collectArraySignals(allLines, [/\bdue date\b/i, /\bstart\b/i, /\bfinish\b/i, /\bschedule\b/i]),
  };
}
