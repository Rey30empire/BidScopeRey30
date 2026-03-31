import { Prisma, PrismaClient } from '@prisma/client';

type ExistsRow = { exists: boolean };
type EstimateLegacyRow = {
  id: string;
  projectId: string;
  estimateType: string | null;
  estimateNumber: string | null;
  title: string | null;
};

const prisma = new PrismaClient();

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
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

async function ensureEstimateColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "estimateType" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "estimateNumber" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "title" TEXT`);
}

async function loadLegacyEstimateRows() {
  return prisma.$queryRaw<EstimateLegacyRow[]>(
    Prisma.sql`
      SELECT "id", "projectId", "estimateType", "estimateNumber", "title"
      FROM "Estimate"
      ORDER BY "projectId" ASC, "createdAt" ASC, "id" ASC
    `,
  );
}

async function backfillEstimateRows(rows: EstimateLegacyRow[]) {
  const projectCounters = new Map<string, number>();
  let updatedRows = 0;

  for (const row of rows) {
    const sequence = (projectCounters.get(row.projectId) ?? 0) + 1;
    projectCounters.set(row.projectId, sequence);

    const nextEstimateType = hasValue(row.estimateType)
      ? row.estimateType!.trim()
      : inferLegacyEstimateType(row.projectId, sequence);
    const nextEstimateNumber = hasValue(row.estimateNumber)
      ? row.estimateNumber!.trim()
      : `LEGACY-${row.id.slice(-8).toUpperCase()}`;
    const nextTitle = hasValue(row.title)
      ? row.title!.trim()
      : inferLegacyEstimateTitle(nextEstimateType, sequence);

    if (
      nextEstimateType !== (row.estimateType ?? '') ||
      nextEstimateNumber !== (row.estimateNumber ?? '') ||
      nextTitle !== (row.title ?? '')
    ) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "Estimate"
          SET
            "estimateType" = ${nextEstimateType},
            "estimateNumber" = ${nextEstimateNumber},
            "title" = ${nextTitle}
          WHERE "id" = ${row.id}
        `,
      );
      updatedRows += 1;
    }
  }

  return updatedRows;
}

async function main() {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.log('Skipping Neon estimate schema prep because NETLIFY_DATABASE_URL is not set.');
    return;
  }

  const estimateTableExists = await tableExists('Estimate');
  if (!estimateTableExists) {
    console.log('Skipping Neon estimate schema prep because Estimate table does not exist yet.');
    return;
  }

  await ensureEstimateColumns();
  const rows = await loadLegacyEstimateRows();
  const updatedRows = await backfillEstimateRows(rows);

  console.log(
    JSON.stringify(
      {
        table: 'Estimate',
        rows: rows.length,
        updatedRows,
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
