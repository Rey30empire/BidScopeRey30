import { Prisma, PrismaClient } from '@prisma/client';

type ExistsRow = { exists: boolean };
type ColumnRow = { column_name: string };
type EstimateLegacyRow = {
  id: string;
  projectId: string;
  estimateType: string | null;
  estimateNumber: string | null;
  title: string | null;
  name?: string | null;
  materialsCost?: number | null;
  laborCost?: number | null;
  equipmentCost?: number | null;
  overhead?: number | null;
  profit?: number | null;
  riskFactor?: number | null;
};

type ColumnDefinition = {
  name: string;
  definition: string;
};

const prisma = new PrismaClient();

const BASE_TABLE_SQL = [
  `
  CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "location" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "projectSize" TEXT,
    "trade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upload',
    "bidDueDate" TIMESTAMP(3),
    "rfiDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "BidFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "hash" TEXT,
    "category" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "summary" TEXT,
    "sheetData" TEXT,
    "metadata" TEXT,
    "isRelevant" BOOLEAN,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BidFile_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT,
    "client" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "bidDueDate" TEXT,
    "rfiDueDate" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "trade" TEXT,
    "scopeHints" TEXT,
    "alternates" TEXT,
    "allowances" TEXT,
    "proposalReqs" TEXT,
    "insuranceReqs" TEXT,
    "scheduleConstraints" TEXT,
    "addendaNotes" TEXT,
    "keySpecs" TEXT,
    "materials" TEXT,
    "relevantSheets" TEXT,
    "scopeAnalysis" TEXT,
    "weatherImpact" TEXT,
    "timeEstimate" TEXT,
    "executiveSummary" TEXT,
    "riskItems" TEXT,
    "rfiSuggestions" TEXT,
    "costEstimate" TEXT,
    "inclusions" TEXT,
    "exclusions" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "Estimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "estimateType" TEXT,
    "estimateNumber" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "EstimateSend" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "sentByUserId" TEXT,
    "sentByName" TEXT,
    "sentByEmail" TEXT,
    "secureToken" TEXT NOT NULL,
    "secureViewUrl" TEXT,
    "secureDownloadUrl" TEXT,
    "htmlTrackingPixelUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Sent',
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "linkExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateSend_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "EstimateOpenEvent" (
    "id" TEXT NOT NULL,
    "estimateSendId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT,
    "isFirstOpen" BOOLEAN NOT NULL DEFAULT false,
    "openCountAtEvent" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateOpenEvent_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "EstimateNotificationEvent" (
    "id" TEXT NOT NULL,
    "estimateSendId" TEXT NOT NULL,
    "estimateOpenEventId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationChannel" TEXT NOT NULL DEFAULT 'email',
    "recipientInternalEmail" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateNotificationEvent_pkey" PRIMARY KEY ("id")
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS "EstimateActivityEvent" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "estimateSendId" TEXT,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateActivityEvent_pkey" PRIMARY KEY ("id")
  )
  `,
] as const;

const ESTIMATE_COLUMNS: ColumnDefinition[] = [
  { name: 'estimateType', definition: 'TEXT' },
  { name: 'estimateNumber', definition: 'TEXT' },
  { name: 'title', definition: 'TEXT' },
  { name: 'versionLabel', definition: `TEXT NOT NULL DEFAULT 'V1'` },
  { name: 'status', definition: `TEXT NOT NULL DEFAULT 'Draft'` },
  { name: 'preparedBy', definition: 'TEXT' },
  { name: 'preparedByTitle', definition: 'TEXT' },
  { name: 'reviewedBy', definition: 'TEXT' },
  { name: 'reviewedByTitle', definition: 'TEXT' },
  { name: 'companyName', definition: 'TEXT' },
  { name: 'companyEmail', definition: 'TEXT' },
  { name: 'companyPhone', definition: 'TEXT' },
  { name: 'companyAddress', definition: 'TEXT' },
  { name: 'clientRecipientName', definition: 'TEXT' },
  { name: 'clientRecipientEmail', definition: 'TEXT' },
  { name: 'validForDays', definition: 'INTEGER NOT NULL DEFAULT 30' },
  { name: 'currency', definition: `TEXT NOT NULL DEFAULT 'USD'` },
  { name: 'executiveSummary', definition: 'TEXT' },
  { name: 'scopeOfWork', definition: 'TEXT' },
  { name: 'inclusions', definition: 'TEXT' },
  { name: 'exclusions', definition: 'TEXT' },
  { name: 'clarifications', definition: 'TEXT' },
  { name: 'qualifications', definition: 'TEXT' },
  { name: 'proposalNotes', definition: 'TEXT' },
  { name: 'keyDocuments', definition: 'TEXT' },
  { name: 'keyPlansAndSpecs', definition: 'TEXT' },
  { name: 'costItems', definition: 'TEXT' },
  { name: 'pricingSummary', definition: 'TEXT' },
  { name: 'questionnaireTemplateId', definition: 'TEXT' },
  { name: 'questionnaireTrade', definition: 'TEXT' },
  { name: 'questionnaireState', definition: 'TEXT' },
  { name: 'internalAssumptions', definition: 'TEXT' },
  { name: 'internalInferredData', definition: 'TEXT' },
  { name: 'internalTechnicalBacking', definition: 'TEXT' },
  { name: 'internalAnalysisNotes', definition: 'TEXT' },
  { name: 'internalReviewComments', definition: 'TEXT' },
  { name: 'riskRegister', definition: 'TEXT' },
  { name: 'rfiRegister', definition: 'TEXT' },
  { name: 'weatherNotes', definition: 'TEXT' },
  { name: 'timeEstimateNotes', definition: 'TEXT' },
  { name: 'acceptanceEnabled', definition: 'BOOLEAN NOT NULL DEFAULT TRUE' },
  { name: 'clientDisclaimer', definition: 'TEXT' },
  { name: 'internalDisclaimer', definition: 'TEXT' },
  { name: 'humanApprovedForClientExport', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { name: 'humanApprovedForSend', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { name: 'approvedForClientExportAt', definition: 'TIMESTAMP(3)' },
  { name: 'approvedForSendAt', definition: 'TIMESTAMP(3)' },
  { name: 'sentCount', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'openCount', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'firstOpenedAt', definition: 'TIMESTAMP(3)' },
  { name: 'lastOpenedAt', definition: 'TIMESTAMP(3)' },
  { name: 'lastSentAt', definition: 'TIMESTAMP(3)' },
];

const ESTIMATE_SEND_COLUMNS: ColumnDefinition[] = [
  { name: 'documentVersion', definition: 'TEXT NOT NULL DEFAULT \'client_trade\'' },
  { name: 'recipientEmail', definition: 'TEXT NOT NULL DEFAULT \'\'' },
  { name: 'recipientName', definition: 'TEXT' },
  { name: 'sentByUserId', definition: 'TEXT' },
  { name: 'sentByName', definition: 'TEXT' },
  { name: 'sentByEmail', definition: 'TEXT' },
  { name: 'secureToken', definition: 'TEXT NOT NULL DEFAULT \'\'' },
  { name: 'secureViewUrl', definition: 'TEXT' },
  { name: 'secureDownloadUrl', definition: 'TEXT' },
  { name: 'htmlTrackingPixelUrl', definition: 'TEXT' },
  { name: 'status', definition: `TEXT NOT NULL DEFAULT 'Sent'` },
  { name: 'openCount', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'firstOpenedAt', definition: 'TIMESTAMP(3)' },
  { name: 'lastOpenedAt', definition: 'TIMESTAMP(3)' },
  { name: 'linkExpiresAt', definition: 'TIMESTAMP(3)' },
  { name: 'sentAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
  { name: 'createdAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
  { name: 'updatedAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
];

const ESTIMATE_OPEN_EVENT_COLUMNS: ColumnDefinition[] = [
  { name: 'openedAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
  { name: 'ipAddress', definition: 'TEXT' },
  { name: 'userAgent', definition: 'TEXT' },
  { name: 'referrer', definition: 'TEXT' },
  { name: 'eventType', definition: 'TEXT NOT NULL DEFAULT \'portal_open\'' },
  { name: 'sourceType', definition: 'TEXT' },
  { name: 'isFirstOpen', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { name: 'openCountAtEvent', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { name: 'createdAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
];

const ESTIMATE_NOTIFICATION_EVENT_COLUMNS: ColumnDefinition[] = [
  { name: 'notifiedAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
  { name: 'notificationChannel', definition: `TEXT NOT NULL DEFAULT 'email'` },
  { name: 'recipientInternalEmail', definition: 'TEXT NOT NULL DEFAULT \'\'' },
  { name: 'deliveryStatus', definition: 'TEXT NOT NULL DEFAULT \'pending\'' },
  { name: 'providerMessageId', definition: 'TEXT' },
  { name: 'createdAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
];

const ESTIMATE_ACTIVITY_EVENT_COLUMNS: ColumnDefinition[] = [
  { name: 'activityType', definition: 'TEXT NOT NULL DEFAULT \'status_changed\'' },
  { name: 'title', definition: 'TEXT NOT NULL DEFAULT \'Activity\'' },
  { name: 'description', definition: 'TEXT' },
  { name: 'metadata', definition: 'TEXT' },
  { name: 'createdAt', definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
];

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function escapeIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeLegacyPercent(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  const numeric = Number(value);
  return Math.abs(numeric) <= 1 ? Math.round(numeric * 10000) / 100 : Math.round(numeric * 100) / 100;
}

function inferLegacyEstimateType(projectId: string, sequence: number) {
  if (sequence === 1) return 'trade';
  if (sequence === 2) return 'global';
  return `legacy-${projectId.slice(-4).toLowerCase()}-${sequence}`;
}

function inferLegacyEstimateTitle(estimateType: string, sequence: number) {
  if (estimateType === 'trade') return 'Legacy Trade Estimate';
  if (estimateType === 'global') return 'Legacy Global Estimate';
  return `Legacy Estimate ${sequence}`;
}

function buildLegacyPricingSummary(row: EstimateLegacyRow, estimateType: string) {
  const materialCost = Number(row.materialsCost || 0);
  const laborCost = Number(row.laborCost || 0);
  const equipmentCost = Number(row.equipmentCost || 0);
  const directSubtotal = Math.round((materialCost + laborCost + equipmentCost) * 100) / 100;
  if (directSubtotal <= 0) {
    return null;
  }

  const overheadPercent = normalizeLegacyPercent(row.overhead);
  const profitPercent = normalizeLegacyPercent(row.profit);
  const contingencyPercent = normalizeLegacyPercent(row.riskFactor);
  const overheadAmount = Math.round((directSubtotal * overheadPercent) / 100 * 100) / 100;
  const profitAmount = Math.round((directSubtotal * profitPercent) / 100 * 100) / 100;
  const contingencyAmount = Math.round((directSubtotal * contingencyPercent) / 100 * 100) / 100;
  const total = Math.round((directSubtotal + overheadAmount + profitAmount + contingencyAmount) * 100) / 100;

  return {
    directSubtotal,
    overheadPercent,
    overheadAmount,
    profitPercent,
    profitAmount,
    contingencyPercent,
    contingencyAmount,
    bondPercent: 0,
    bondAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total,
    validityDays: 30,
    budgetary: estimateType === 'global',
    proposalLabel: estimateType === 'global' ? 'Budgetary Estimate' : 'Trade Estimate',
  };
}

function buildLegacyCostItems(row: EstimateLegacyRow, title: string) {
  const materialCost = Number(row.materialsCost || 0);
  const laborCost = Number(row.laborCost || 0);
  const equipmentCost = Number(row.equipmentCost || 0);
  const subtotal = Math.round((materialCost + laborCost + equipmentCost) * 100) / 100;
  if (subtotal <= 0) {
    return null;
  }

  return [
    {
      id: `${row.id}-legacy`,
      section: 'Legacy Estimate',
      description: title,
      quantity: 1,
      unit: 'LS',
      materialCost,
      laborCost,
      equipmentCost,
      subcontractCost: 0,
      subtotal,
    },
  ];
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<ExistsRow[]>(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${tableName}
      ) AS "exists"
    `,
  );

  return rows[0]?.exists ?? false;
}

async function indexExists(indexName: string) {
  const rows = await prisma.$queryRaw<ExistsRow[]>(
    Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ${indexName}
      ) AS "exists"
    `,
  );

  return rows[0]?.exists ?? false;
}

async function getColumnNames(tableName: string) {
  const rows = await prisma.$queryRaw<ColumnRow[]>(
    Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `,
  );

  return new Set(rows.map((row) => row.column_name));
}

async function ensureTables() {
  for (const sql of BASE_TABLE_SQL) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function ensureColumns(tableName: string, columns: ColumnDefinition[]) {
  const existing = await getColumnNames(tableName);

  for (const column of columns) {
    if (existing.has(column.name)) {
      continue;
    }

    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${escapeIdentifier(tableName)} ADD COLUMN IF NOT EXISTS ${escapeIdentifier(column.name)} ${column.definition}`,
    );
  }
}

async function hasDuplicateValues(tableName: string, columns: string[]) {
  const escapedColumns = columns.map(escapeIdentifier);
  const sql = `
    SELECT 1
    FROM ${escapeIdentifier(tableName)}
    GROUP BY ${escapedColumns.join(', ')}
    HAVING COUNT(*) > 1
    LIMIT 1
  `;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);
  return rows.length > 0;
}

async function ensureUniqueIndex(tableName: string, indexName: string, columns: string[]) {
  if (!(await tableExists(tableName))) {
    return { created: false, skipped: 'missing_table' };
  }

  if (await indexExists(indexName)) {
    return { created: false, skipped: 'exists' };
  }

  if (await hasDuplicateValues(tableName, columns)) {
    return { created: false, skipped: 'duplicates' };
  }

  const escapedColumns = columns.map(escapeIdentifier).join(', ');
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${escapeIdentifier(indexName)} ON ${escapeIdentifier(tableName)} (${escapedColumns})`,
  );
  return { created: true, skipped: null };
}

async function loadLegacyEstimateRows(existingColumns: Set<string>) {
  const optionalColumns = [
    'name',
    'materialsCost',
    'laborCost',
    'equipmentCost',
    'overhead',
    'profit',
    'riskFactor',
  ].filter((column) => existingColumns.has(column));

  const selectColumns = [
    '"id"',
    '"projectId"',
    existingColumns.has('estimateType') ? '"estimateType"' : 'NULL AS "estimateType"',
    existingColumns.has('estimateNumber') ? '"estimateNumber"' : 'NULL AS "estimateNumber"',
    existingColumns.has('title') ? '"title"' : 'NULL AS "title"',
    ...optionalColumns.map((column) => `${escapeIdentifier(column)} AS ${escapeIdentifier(column)}`),
  ];

  return prisma.$queryRawUnsafe<EstimateLegacyRow[]>(
    `
      SELECT ${selectColumns.join(', ')}
      FROM "Estimate"
      ORDER BY "projectId" ASC, "createdAt" ASC, "id" ASC
    `,
  );
}

async function backfillEstimateRows(existingColumns: Set<string>) {
  const rows = await loadLegacyEstimateRows(existingColumns);
  const projectCounters = new Map<string, number>();
  const usedTypesByProject = new Map<string, Set<string>>();
  let updatedRows = 0;

  for (const row of rows) {
    const sequence = (projectCounters.get(row.projectId) ?? 0) + 1;
    projectCounters.set(row.projectId, sequence);

    const usedTypes = usedTypesByProject.get(row.projectId) ?? new Set<string>();
    const preferredType = hasValue(row.estimateType) ? row.estimateType!.trim().toLowerCase() : inferLegacyEstimateType(row.projectId, sequence);
    let nextEstimateType = preferredType;
    if (usedTypes.has(nextEstimateType)) {
      nextEstimateType = inferLegacyEstimateType(row.projectId, sequence);
      let suffix = 1;
      while (usedTypes.has(nextEstimateType)) {
        suffix += 1;
        nextEstimateType = `legacy-${row.projectId.slice(-4).toLowerCase()}-${sequence}-${suffix}`;
      }
    }
    usedTypes.add(nextEstimateType);
    usedTypesByProject.set(row.projectId, usedTypes);

    const legacyName = hasValue(row.title) ? row.title!.trim() : hasValue(row.name) ? row.name!.trim() : '';
    const nextEstimateNumber = hasValue(row.estimateNumber)
      ? row.estimateNumber!.trim()
      : `LEGACY-${row.id.slice(-8).toUpperCase()}`;
    const nextTitle = legacyName || inferLegacyEstimateTitle(nextEstimateType, sequence);
    const pricingSummary = buildLegacyPricingSummary(row, nextEstimateType);
    const costItems = buildLegacyCostItems(row, nextTitle);

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Estimate"
        SET
          "estimateType" = ${nextEstimateType},
          "estimateNumber" = ${nextEstimateNumber},
          "title" = ${nextTitle},
          "versionLabel" = COALESCE(NULLIF("versionLabel", ''), 'V1'),
          "status" = COALESCE(NULLIF("status", ''), 'Needs Human Review'),
          "validForDays" = COALESCE("validForDays", 30),
          "currency" = COALESCE(NULLIF("currency", ''), 'USD'),
          "acceptanceEnabled" = COALESCE("acceptanceEnabled", TRUE),
          "humanApprovedForClientExport" = COALESCE("humanApprovedForClientExport", FALSE),
          "humanApprovedForSend" = COALESCE("humanApprovedForSend", FALSE),
          "sentCount" = COALESCE("sentCount", 0),
          "openCount" = COALESCE("openCount", 0),
          "scopeOfWork" = COALESCE(NULLIF("scopeOfWork", ''), ${`Scope to be confirmed during human review for ${nextTitle}.`}),
          "executiveSummary" = COALESCE(NULLIF("executiveSummary", ''), ${`Legacy estimate recovered from production data for ${nextTitle}. Review and refine before client delivery.`}),
          "pricingSummary" = CASE
            WHEN COALESCE(NULLIF("pricingSummary", ''), '') <> '' THEN "pricingSummary"
            ELSE ${pricingSummary ? JSON.stringify(pricingSummary) : null}
          END,
          "costItems" = CASE
            WHEN COALESCE(NULLIF("costItems", ''), '') <> '' THEN "costItems"
            ELSE ${costItems ? JSON.stringify(costItems) : null}
          END
        WHERE "id" = ${row.id}
      `,
    );

    updatedRows += 1;
  }

  return { rows, updatedRows };
}

async function main() {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.log('Skipping Neon estimate schema prep because NETLIFY_DATABASE_URL is not set.');
    return;
  }

  await ensureTables();
  await ensureColumns('Estimate', ESTIMATE_COLUMNS);
  await ensureColumns('EstimateSend', ESTIMATE_SEND_COLUMNS);
  await ensureColumns('EstimateOpenEvent', ESTIMATE_OPEN_EVENT_COLUMNS);
  await ensureColumns('EstimateNotificationEvent', ESTIMATE_NOTIFICATION_EVENT_COLUMNS);
  await ensureColumns('EstimateActivityEvent', ESTIMATE_ACTIVITY_EVENT_COLUMNS);

  const estimateColumns = await getColumnNames('Estimate');
  const { rows, updatedRows } = await backfillEstimateRows(estimateColumns);

  const analysisIndex = await ensureUniqueIndex('Analysis', 'Analysis_projectId_key', ['projectId']);
  const settingsIndex = await ensureUniqueIndex('Settings', 'Settings_key_key', ['key']);
  const estimateIndex = await ensureUniqueIndex('Estimate', 'Estimate_projectId_estimateType_key', ['projectId', 'estimateType']);
  const tokenIndex = await ensureUniqueIndex('EstimateSend', 'EstimateSend_secureToken_key', ['secureToken']);

  console.log(
    JSON.stringify(
      {
        tablesEnsured: ['Project', 'BidFile', 'Analysis', 'Settings', 'Estimate', 'EstimateSend', 'EstimateOpenEvent', 'EstimateNotificationEvent', 'EstimateActivityEvent'],
        estimateRows: rows.length,
        estimateRowsUpdated: updatedRows,
        indexes: {
          analysisProjectId: analysisIndex,
          settingsKey: settingsIndex,
          estimateProjectType: estimateIndex,
          estimateSendSecureToken: tokenIndex,
        },
        status: 'prepared',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Failed to prepare Neon estimate schema.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
