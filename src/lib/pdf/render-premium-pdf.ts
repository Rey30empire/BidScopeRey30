import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib';
import type { EstimatePremiumRenderModel, EstimateSummaryRow } from '@/lib/estimates/estimate-render-model';
import {
  PREMIUM_TEMPLATE_BACKGROUND_PATH,
  PREMIUM_TEMPLATE_MAP,
  PREMIUM_TEMPLATE_PAGE,
  type TemplateRect,
} from '@/lib/pdf/premium-template-map';
import { loadBrandingImageBytes, loadSignatureImageBytes } from '@/lib/pdf/pdf-branding';
import { fitTextSize, loadPremiumFonts, wrapText } from '@/lib/pdf/pdf-premium-layout';

const DEFAULT_TEMPLATE_BRAND = 'TOP NOTCH REMODELING LLC';

const PAPER_RGB = rgb(0.978, 0.964, 0.934);
const CARD_RGB = rgb(0.988, 0.978, 0.955);
const CARD_SHADE_RGB = rgb(0.969, 0.948, 0.91);
const INK_RGB = rgb(0.13, 0.186, 0.293);
const MUTED_RGB = rgb(0.36, 0.33, 0.3);
const LINE_RGB = rgb(0.833, 0.774, 0.681);
const ACCENT_RGB = rgb(0.616, 0.477, 0.267);

type PremiumFonts = Awaited<ReturnType<typeof loadPremiumFonts>>;

function resolveAssetPath(source: string) {
  return path.join(process.cwd(), source.replace(/^[/\\]+/, ''));
}

async function loadTemplateBackgroundBytes() {
  return readFile(resolveAssetPath(PREMIUM_TEMPLATE_BACKGROUND_PATH));
}

async function embedImage(pdf: PDFDocument, bytes: Buffer | null) {
  if (!bytes) return null;
  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

function topToY(top: number, height = 0) {
  return PREMIUM_TEMPLATE_PAGE.height - top - height;
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getMetaField(model: EstimatePremiumRenderModel, label: string) {
  return model.metaFields.find((field) => field.label === label)?.value || '';
}

function getInfoField(model: EstimatePremiumRenderModel, label: string) {
  return model.infoLeft.find((field) => field.label === label)?.value || '';
}

function parseCurrency(value: string | null | undefined) {
  const numeric = Number((value || '').replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function paginateItems<T>(items: T[], firstPageSize: number, continuationSize: number) {
  if (!items.length) return [[]] as T[][];

  const pages: T[][] = [items.slice(0, firstPageSize)];
  let index = firstPageSize;
  while (index < items.length) {
    pages.push(items.slice(index, index + continuationSize));
    index += continuationSize;
  }
  return pages;
}

function flattenInternalNotes(model: EstimatePremiumRenderModel) {
  return model.internalSections.flatMap((section) =>
    section.items.map((item) => `${section.title}: ${normalizeText(item)}`),
  );
}

function buildMaterialLines(model: EstimatePremiumRenderModel) {
  return model.materialSelectionBlocks
    .map((block) => {
      const active = block.options.find((option) => option.active)?.label || block.answer || block.title;
      return `${block.title}: ${normalizeText(active)}`;
    })
    .filter(Boolean);
}

function buildPricingTagLines(model: EstimatePremiumRenderModel) {
  return model.pricingFields
    .filter((field) =>
      /pricing method|material unit|labor basis|waste factor|markup|overhead|profit|contingency|tax/i.test(field.label),
    )
    .map((field) => `${field.label}: ${field.value}`)
    .filter(Boolean);
}

function buildSupportLines(model: EstimatePremiumRenderModel) {
  return [
    ...model.exclusions.map((item) => `Exclusion: ${item}`),
    ...model.proposalNotes.map((item) => `Proposal note: ${item}`),
    ...model.costBreakdownNotes.map((item) => `Commercial note: ${item}`),
    ...flattenInternalNotes(model),
  ].filter(Boolean);
}

function buildClarificationLines(model: EstimatePremiumRenderModel) {
  return [
    ...model.clarifications.map((item) => `Clarification: ${item}`),
    ...model.qualifications.map((item) => `Qualification: ${item}`),
  ].filter(Boolean);
}

function buildCostAllocation(model: EstimatePremiumRenderModel) {
  const material = model.costRows.reduce((sum, row) => sum + parseCurrency(row.material), 0);
  const labor = model.costRows.reduce((sum, row) => sum + parseCurrency(row.labor), 0);
  const equipment = model.costRows.reduce((sum, row) => sum + parseCurrency(row.equipment), 0);
  return [
    { label: 'Material', value: formatCurrency(material) },
    { label: 'Labor', value: formatCurrency(labor) },
    { label: 'Equipment / Other', value: formatCurrency(equipment) },
  ];
}

function drawBackground(page: PDFPage, backgroundImage: PDFImage) {
  page.drawImage(backgroundImage, {
    x: 0,
    y: 0,
    width: PREMIUM_TEMPLATE_PAGE.width,
    height: PREMIUM_TEMPLATE_PAGE.height,
  });
}

function drawCard(page: PDFPage, rect: TemplateRect, title: string, fonts: PremiumFonts) {
  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, rect.height),
    width: rect.width,
    height: rect.height,
    color: CARD_RGB,
    borderColor: LINE_RGB,
    borderWidth: 0.9,
  });

  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, 28),
    width: rect.width,
    height: 28,
    color: CARD_SHADE_RGB,
  });

  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, 28),
    width: 8,
    height: 28,
    color: ACCENT_RGB,
  });

  page.drawText(title.toUpperCase(), {
    x: rect.x + 18,
    y: topToY(rect.top + 7, 13),
    font: fonts.serifBold,
    size: 13,
    color: INK_RGB,
  });

  page.drawLine({
    start: { x: rect.x + 14, y: topToY(rect.top + 28) },
    end: { x: rect.x + rect.width - 14, y: topToY(rect.top + 28) },
    thickness: 0.6,
    color: LINE_RGB,
  });
}

function drawSingleLineText(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  width: number,
  font: PDFFont,
  size: number,
  options?: { color?: ReturnType<typeof rgb>; align?: 'left' | 'center' | 'right' },
) {
  const content = normalizeText(text);
  if (!content) return;

  const fitted = fitTextSize(font, content, width, size, Math.max(7, size - 2));
  const measured = font.widthOfTextAtSize(content, fitted);
  const startX =
    options?.align === 'right'
      ? x + width - measured
      : options?.align === 'center'
        ? x + (width - measured) / 2
        : x;

  page.drawText(content, {
    x: startX,
    y: topToY(top, fitted),
    font,
    size: fitted,
    color: options?.color || INK_RGB,
  });
}

function drawWrappedParagraph(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  width: number,
  maxLines: number,
  font: PDFFont,
  size: number,
  color = MUTED_RGB,
  lineHeight = size * 1.34,
) {
  const lines = wrapText(font, size, normalizeText(text), width).slice(0, maxLines);
  let currentTop = top;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: topToY(currentTop, size),
      font,
      size,
      color,
    });
    currentTop += lineHeight;
  }
}

function drawBulletList(
  page: PDFPage,
  items: string[],
  x: number,
  top: number,
  width: number,
  maxItems: number,
  fonts: PremiumFonts,
  options?: { fontSize?: number; lineHeight?: number; bulletColor?: ReturnType<typeof rgb> },
) {
  const fontSize = options?.fontSize || 9.2;
  const lineHeight = options?.lineHeight || fontSize * 1.5;
  const bulletColor = options?.bulletColor || ACCENT_RGB;
  let currentTop = top;

  for (const item of items.slice(0, maxItems)) {
    const lines = wrapText(fonts.sansRegular, fontSize, normalizeText(item), width - 16).slice(0, 2);
    if (!lines.length) continue;

    page.drawText('-', {
      x,
      y: topToY(currentTop, fontSize),
      font: fonts.sansBold,
      size: fontSize + 1,
      color: bulletColor,
    });

    for (const [index, line] of lines.entries()) {
      page.drawText(line, {
        x: x + 14,
        y: topToY(currentTop + index * (fontSize * 1.18), fontSize),
        font: fonts.sansRegular,
        size: fontSize,
        color: MUTED_RGB,
      });
    }

    currentTop += lineHeight;
  }
}

function drawTagRow(page: PDFPage, tags: string[], x: number, top: number, maxWidth: number, fonts: PremiumFonts) {
  let cursorX = x;
  let cursorTop = top;
  const height = 22;

  for (const tag of tags.filter(Boolean)) {
    const label = truncateText(tag, 36);
    const width = Math.min(maxWidth, Math.max(98, fonts.sansBold.widthOfTextAtSize(label, 8.6) + 24));
    if (cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorTop += height + 8;
    }

    page.drawRectangle({
      x: cursorX,
      y: topToY(cursorTop, height),
      width,
      height,
      color: PAPER_RGB,
      borderColor: LINE_RGB,
      borderWidth: 0.7,
    });

    drawSingleLineText(page, label, cursorX + 10, cursorTop + 5, width - 20, fonts.sansBold, 8.6, {
      color: INK_RGB,
      align: 'center',
    });

    cursorX += width + 8;
  }
}

function drawLabelValue(page: PDFPage, label: string, value: string, x: number, top: number, labelWidth: number, valueWidth: number, fonts: PremiumFonts) {
  page.drawText(label, {
    x,
    y: topToY(top, 9.2),
    font: fonts.sansBold,
    size: 9.2,
    color: INK_RGB,
  });
  drawSingleLineText(page, value, x + labelWidth, top, valueWidth, fonts.sansRegular, 9.1, { color: MUTED_RGB });
}

function drawMetaFields(page: PDFPage, model: EstimatePremiumRenderModel, fonts: PremiumFonts) {
  drawSingleLineText(page, getMetaField(model, 'Estimate #'), PREMIUM_TEMPLATE_MAP.meta.estimateNumber.x, PREMIUM_TEMPLATE_MAP.meta.estimateNumber.top, PREMIUM_TEMPLATE_MAP.meta.estimateNumber.width, fonts.sansRegular, 10.5, { align: 'right' });
  drawSingleLineText(page, getMetaField(model, 'Date'), PREMIUM_TEMPLATE_MAP.meta.date.x, PREMIUM_TEMPLATE_MAP.meta.date.top, PREMIUM_TEMPLATE_MAP.meta.date.width, fonts.sansRegular, 10.5, { align: 'right' });
  drawSingleLineText(page, getMetaField(model, 'Version'), PREMIUM_TEMPLATE_MAP.meta.version.x, PREMIUM_TEMPLATE_MAP.meta.version.top, PREMIUM_TEMPLATE_MAP.meta.version.width, fonts.sansRegular, 10.5, { align: 'right' });
  drawSingleLineText(page, getMetaField(model, 'Valid for'), PREMIUM_TEMPLATE_MAP.meta.validFor.x, PREMIUM_TEMPLATE_MAP.meta.validFor.top, PREMIUM_TEMPLATE_MAP.meta.validFor.width, fonts.sansRegular, 10.5, { align: 'right' });
}

function drawBrandOverlay(page: PDFPage, model: EstimatePremiumRenderModel, fonts: PremiumFonts, logoImage: PDFImage | null) {
  const company = normalizeText(model.branding.companyName).toUpperCase();
  if (company === DEFAULT_TEMPLATE_BRAND) {
    return;
  }

  const rect = { x: 208, top: 18, width: 532, height: 136 };
  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, rect.height),
    width: rect.width,
    height: rect.height,
    color: PAPER_RGB,
    opacity: 0.96,
  });

  if (logoImage) {
    const scaled = logoImage.scale(0.17);
    page.drawImage(logoImage, {
      x: rect.x + 32,
      y: topToY(rect.top + 20, scaled.height),
      width: scaled.width,
      height: scaled.height,
      opacity: 0.98,
    });
  }

  const companySize = fitTextSize(fonts.serifBold, company, 320, 20, 12);
  page.drawText(company, {
    x: rect.x + 176,
    y: topToY(rect.top + 36, companySize),
    font: fonts.serifBold,
    size: companySize,
    color: INK_RGB,
  });

  const subtitle = normalizeText(model.branding.subtitle).toUpperCase();
  const subtitleSize = fitTextSize(fonts.sansBold, subtitle, 320, 8.6, 7.4);
  page.drawText(subtitle, {
    x: rect.x + 176,
    y: topToY(rect.top + 68, subtitleSize),
    font: fonts.sansBold,
    size: subtitleSize,
    color: ACCENT_RGB,
  });
}

function drawOverviewCard(page: PDFPage, model: EstimatePremiumRenderModel, fonts: PremiumFonts) {
  const rect = PREMIUM_TEMPLATE_MAP.cards.overview;
  drawCard(page, rect, 'Project Overview', fonts);

  const leftX = rect.x + 16;
  const rightX = rect.x + 404;
  const top = rect.top + 42;

  drawLabelValue(page, 'Project', getInfoField(model, 'Project'), leftX, top, 64, 280, fonts);
  drawLabelValue(page, 'Client / GC', getInfoField(model, 'Client / GC'), leftX, top + 22, 64, 280, fonts);
  drawLabelValue(page, 'Location', getInfoField(model, 'Location'), leftX, top + 44, 64, 280, fonts);
  drawLabelValue(page, 'Trade', getInfoField(model, 'Trade'), leftX, top + 66, 64, 280, fonts);

  drawLabelValue(page, 'Estimate #', getMetaField(model, 'Estimate #'), rightX, top, 66, 160, fonts);
  drawLabelValue(page, 'Date', getMetaField(model, 'Date'), rightX, top + 22, 66, 160, fonts);
  drawLabelValue(page, 'Estimator', getInfoField(model, 'Estimator'), rightX, top + 44, 66, 160, fonts);
  drawLabelValue(page, 'Bid Due', getInfoField(model, 'Bid due date'), rightX, top + 66, 66, 160, fonts);

  drawTagRow(
    page,
    [
      model.estimateSubtitle,
      model.statusLabel,
      getMetaField(model, 'Valid for'),
      getInfoField(model, 'Trade'),
    ],
    rect.x + 16,
    rect.top + 112,
    rect.width - 32,
    fonts,
  );
}

function drawNoteStrip(page: PDFPage, model: EstimatePremiumRenderModel, fonts: PremiumFonts) {
  const rect = PREMIUM_TEMPLATE_MAP.cards.note;
  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, rect.height),
    width: rect.width,
    height: rect.height,
    color: CARD_SHADE_RGB,
    borderColor: LINE_RGB,
    borderWidth: 0.8,
  });
  page.drawRectangle({
    x: rect.x,
    y: topToY(rect.top, rect.height),
    width: 8,
    height: rect.height,
    color: ACCENT_RGB,
  });
  drawWrappedParagraph(page, model.executiveSummary || model.preliminaryNote, rect.x + 20, rect.top + 10, rect.width - 250, 2, fonts.sansRegular, 10.6, MUTED_RGB, 14);
  drawSingleLineText(page, 'Total Estimate', rect.x + rect.width - 188, rect.top + 10, 160, fonts.sansBold, 9.2, {
    align: 'right',
    color: MUTED_RGB,
  });
  drawSingleLineText(page, model.finalTotal, rect.x + rect.width - 188, rect.top + 26, 160, fonts.sansBold, 16, {
    align: 'right',
    color: ACCENT_RGB,
  });
}

function drawFirstPageLeftCard(page: PDFPage, model: EstimatePremiumRenderModel, fonts: PremiumFonts) {
  const rect = PREMIUM_TEMPLATE_MAP.cards.left;
  drawCard(page, rect, 'Scope, Materials & Labor', fonts);

  page.drawText('Scope of Work', {
    x: rect.x + 16,
    y: topToY(rect.top + 42, 10.5),
    font: fonts.sansBold,
    size: 10.5,
    color: INK_RGB,
  });
  drawWrappedParagraph(page, model.scopeOfWork || model.executiveSummary, rect.x + 16, rect.top + 60, rect.width - 32, 4, fonts.sansRegular, 9.8);

  page.drawText('Material Selection', {
    x: rect.x + 16,
    y: topToY(rect.top + 138, 10.3),
    font: fonts.sansBold,
    size: 10.3,
    color: INK_RGB,
  });
  drawBulletList(page, buildMaterialLines(model), rect.x + 16, rect.top + 148, rect.width - 32, 4, fonts, {
    fontSize: 9,
    lineHeight: 23,
  });

  page.drawText('Labor & Inclusions', {
    x: rect.x + 16,
    y: topToY(rect.top + 220, 10.3),
    font: fonts.sansBold,
    size: 10.3,
    color: INK_RGB,
  });

  const inclusionLines = [
    ...buildPricingTagLines(model).slice(0, 2),
    ...model.inclusions.slice(0, 2).map((item) => `Included: ${item}`),
  ];
  drawBulletList(page, inclusionLines, rect.x + 16, rect.top + 238, rect.width - 32, 4, fonts, {
    fontSize: 8.9,
    lineHeight: 22.5,
  });
}

function drawCostAllocation(page: PDFPage, model: EstimatePremiumRenderModel, rect: TemplateRect, fonts: PremiumFonts) {
  const allocation = buildCostAllocation(model);
  let top = rect.top + 48;
  for (const item of allocation) {
    page.drawText(item.label, {
      x: rect.x + 16,
      y: topToY(top, 9.8),
      font: fonts.sansBold,
      size: 9.8,
      color: INK_RGB,
    });
    drawSingleLineText(page, item.value, rect.x + 190, top, rect.width - 206, fonts.sansBold, 10.4, {
      align: 'right',
      color: ACCENT_RGB,
    });
    top += 22;
  }
}

function drawFirstPageRightCard(page: PDFPage, model: EstimatePremiumRenderModel, supportLines: string[], fonts: PremiumFonts) {
  const rect = PREMIUM_TEMPLATE_MAP.cards.right;
  drawCard(page, rect, 'Pricing Basis & Commercial Notes', fonts);
  drawCostAllocation(page, model, rect, fonts);

  page.drawText('Pricing Basis', {
    x: rect.x + 16,
    y: topToY(rect.top + 124, 10.3),
    font: fonts.sansBold,
    size: 10.3,
    color: INK_RGB,
  });
  drawBulletList(page, buildPricingTagLines(model).slice(0, 4), rect.x + 16, rect.top + 142, rect.width - 32, 4, fonts, {
    fontSize: 8.9,
    lineHeight: 21,
  });

  page.drawText('Exclusions & Notes', {
    x: rect.x + 16,
    y: topToY(rect.top + 208, 10.3),
    font: fonts.sansBold,
    size: 10.3,
    color: INK_RGB,
  });
  drawBulletList(page, supportLines, rect.x + 16, rect.top + 226, rect.width - 32, 5, fonts, {
    fontSize: 8.7,
    lineHeight: 21,
  });
}

function drawTableCard(page: PDFPage, rect: TemplateRect, rows: EstimatePremiumRenderModel['costRows'], fonts: PremiumFonts) {
  drawCard(page, rect, 'Detailed Cost Breakdown', fonts);

  const headerTop = rect.top + 38;
  page.drawRectangle({
    x: rect.x + 12,
    y: topToY(headerTop, PREMIUM_TEMPLATE_MAP.table.headerHeight),
    width: rect.width - 24,
    height: PREMIUM_TEMPLATE_MAP.table.headerHeight,
      color: CARD_SHADE_RGB,
      borderColor: LINE_RGB,
      borderWidth: 0.7,
  });

  const headerFont = fonts.sansBold;
  const columns = PREMIUM_TEMPLATE_MAP.table.columns;
  const headers: Array<[keyof typeof columns, string, 'left' | 'right' | 'center']> = [
    ['item', 'Item', 'left'],
    ['description', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['unit', 'Unit', 'center'],
    ['material', 'Material', 'right'],
    ['labor', 'Labor', 'right'],
    ['equipment', 'Equip.', 'right'],
    ['subtotal', 'Subtotal', 'right'],
  ];

  for (const [key, label, align] of headers) {
    const column = columns[key];
    drawSingleLineText(page, label, column.x, headerTop + 7, column.width, headerFont, 8.2, {
      color: INK_RGB,
      align,
    });
  }

  let rowTop = headerTop + PREMIUM_TEMPLATE_MAP.table.headerHeight + 8;
  rows.forEach((row) => {
    page.drawLine({
      start: { x: rect.x + 12, y: topToY(rowTop - 4) },
      end: { x: rect.x + rect.width - 12, y: topToY(rowTop - 4) },
      thickness: 0.45,
      color: LINE_RGB,
      opacity: 0.65,
    });

    drawSingleLineText(page, row.item || 'Scope', columns.item.x, rowTop + 2, columns.item.width, fonts.sansRegular, 8.8);
    drawSingleLineText(page, truncateText(row.description, 52), columns.description.x, rowTop + 2, columns.description.width, fonts.sansRegular, 8.8);
    drawSingleLineText(page, row.quantity, columns.quantity.x, rowTop + 2, columns.quantity.width, fonts.sansRegular, 8.8, { align: 'right' });
    drawSingleLineText(page, row.unit, columns.unit.x, rowTop + 2, columns.unit.width, fonts.sansRegular, 8.6, { align: 'center' });
    drawSingleLineText(page, row.material, columns.material.x, rowTop + 2, columns.material.width, fonts.sansRegular, 8.8, { align: 'right' });
    drawSingleLineText(page, row.labor, columns.labor.x, rowTop + 2, columns.labor.width, fonts.sansRegular, 8.8, { align: 'right' });
    drawSingleLineText(page, row.equipment, columns.equipment.x, rowTop + 2, columns.equipment.width, fonts.sansRegular, 8.8, { align: 'right' });
    drawSingleLineText(page, row.subtotal, columns.subtotal.x, rowTop + 2, columns.subtotal.width, fonts.sansBold, 9, { align: 'right', color: INK_RGB });
    rowTop += PREMIUM_TEMPLATE_MAP.table.rowHeight;
  });
}

function drawSummaryCard(page: PDFPage, rect: TemplateRect, summaryRows: EstimateSummaryRow[], fonts: PremiumFonts) {
  drawCard(page, rect, 'Summary', fonts);
  let top = rect.top + 44;

  summaryRows.forEach((row) => {
    const font = row.emphasize ? fonts.sansBold : fonts.sansRegular;
    const size = row.emphasize ? 11.6 : 9.1;
    if (row.emphasize) {
      page.drawRectangle({
        x: rect.x + 10,
        y: topToY(top - 4, 24),
        width: rect.width - 20,
        height: 24,
        color: CARD_SHADE_RGB,
        borderColor: LINE_RGB,
        borderWidth: 0.6,
      });
    }
    page.drawText(row.label, {
      x: rect.x + 14,
      y: topToY(top, size),
      font,
      size,
      color: row.emphasize ? INK_RGB : MUTED_RGB,
    });
    drawSingleLineText(page, row.value, rect.x + 82, top, rect.width - 96, font, size, {
      align: 'right',
      color: row.emphasize ? ACCENT_RGB : INK_RGB,
    });
    top += row.emphasize ? 28 : 21;
  });
}

function drawSignatureCard(
  page: PDFPage,
  rect: TemplateRect,
  model: EstimatePremiumRenderModel,
  fonts: PremiumFonts,
  signatureImage: PDFImage | null,
  pageNumber: number,
  pageCount: number,
) {
  drawCard(page, rect, 'Approval & Signature', fonts);

  const signatureTop = rect.top + 44;
  if (signatureImage) {
    const scaled = signatureImage.scale(0.16);
    page.drawImage(signatureImage, {
      x: rect.x + (rect.width - scaled.width) / 2,
      y: topToY(signatureTop, scaled.height),
      width: scaled.width,
      height: scaled.height,
      opacity: 0.96,
    });
  } else {
    const signatureText = normalizeText(model.signatureName || model.branding.signatureTextFallback);
    const size = fitTextSize(fonts.serifBold, signatureText, rect.width - 24, 20, 12);
    drawSingleLineText(page, signatureText, rect.x + 12, signatureTop + 16, rect.width - 24, fonts.serifBold, size, {
      align: 'center',
      color: INK_RGB,
    });
  }

  drawSingleLineText(page, model.signatureLabel, rect.x + 14, rect.top + 108, rect.width - 28, fonts.sansBold, 9, { color: MUTED_RGB });
  drawSingleLineText(page, model.signatureNote, rect.x + 14, rect.top + 129, rect.width - 28, fonts.sansRegular, 8.7, { color: MUTED_RGB });
  drawSingleLineText(page, `${model.footerGeneratedByText} - Page ${pageNumber} of ${pageCount}`, rect.x + 14, rect.top + 154, rect.width - 28, fonts.sansBold, 8.4, {
    align: 'center',
    color: ACCENT_RGB,
  });
}

function drawFooterNotes(page: PDFPage, rect: TemplateRect, title: string, items: string[], fonts: PremiumFonts) {
  drawCard(page, rect, title, fonts);
  drawBulletList(page, items, rect.x + 16, rect.top + 46, rect.width - 32, 7, fonts, {
    fontSize: 8.9,
    lineHeight: 23,
  });
}

function drawContinuationHeader(page: PDFPage, rect: TemplateRect, model: EstimatePremiumRenderModel, fonts: PremiumFonts, pageNumber: number) {
  drawCard(page, rect, 'Detailed Cost Breakdown Continued', fonts);
  drawLabelValue(page, 'Project', getInfoField(model, 'Project'), rect.x + 16, rect.top + 18, 56, 300, fonts);
  drawLabelValue(page, 'Trade', getInfoField(model, 'Trade'), rect.x + 388, rect.top + 18, 48, 150, fonts);
  drawLabelValue(page, 'Estimate #', getMetaField(model, 'Estimate #'), rect.x + 16, rect.top + 40, 56, 150, fonts);
  drawLabelValue(page, 'Page', String(pageNumber), rect.x + 388, rect.top + 40, 48, 52, fonts);
}

function drawSupportCard(page: PDFPage, rect: TemplateRect, items: string[], fonts: PremiumFonts, maxItems = 8) {
  drawCard(page, rect, 'Supporting Notes & Trade Conditions', fonts);
  drawBulletList(page, items, rect.x + 16, rect.top + 44, rect.width - 32, maxItems, fonts, {
    fontSize: 9,
    lineHeight: 23,
  });
}

function renderFirstPage(
  page: PDFPage,
  model: EstimatePremiumRenderModel,
  fonts: PremiumFonts,
  backgroundImage: PDFImage,
  logoImage: PDFImage | null,
  signatureImage: PDFImage | null,
  rows: EstimatePremiumRenderModel['costRows'],
  supportLines: string[],
  footerLines: string[],
  pageCount: number,
) {
  drawBackground(page, backgroundImage);
  drawBrandOverlay(page, model, fonts, logoImage);
  drawMetaFields(page, model, fonts);
  drawOverviewCard(page, model, fonts);
  drawNoteStrip(page, model, fonts);
  drawFirstPageLeftCard(page, model, fonts);
  drawFirstPageRightCard(page, model, supportLines, fonts);
  drawTableCard(page, PREMIUM_TEMPLATE_MAP.cards.table, rows, fonts);
  drawFooterNotes(page, PREMIUM_TEMPLATE_MAP.cards.footerLeft, 'Clarifications & Qualifications', footerLines, fonts);
  drawSummaryCard(page, PREMIUM_TEMPLATE_MAP.cards.footerCenter, model.summaryRows, fonts);
  drawSignatureCard(page, PREMIUM_TEMPLATE_MAP.cards.footerRight, model, fonts, signatureImage, 1, pageCount);
}

function renderContinuationPage(
  page: PDFPage,
  model: EstimatePremiumRenderModel,
  fonts: PremiumFonts,
  backgroundImage: PDFImage,
  logoImage: PDFImage | null,
  signatureImage: PDFImage | null,
  rows: EstimatePremiumRenderModel['costRows'],
  supportLines: string[],
  footerLines: string[],
  pageNumber: number,
  pageCount: number,
) {
  drawBackground(page, backgroundImage);
  drawBrandOverlay(page, model, fonts, logoImage);
  drawMetaFields(page, model, fonts);
  drawContinuationHeader(page, PREMIUM_TEMPLATE_MAP.continuation.header, model, fonts, pageNumber);
  drawSupportCard(page, PREMIUM_TEMPLATE_MAP.continuation.support, supportLines.length ? supportLines : ['Supporting notes carried on the prior page.'], fonts, 5);
  if (rows.length) {
    drawTableCard(page, PREMIUM_TEMPLATE_MAP.continuation.table, rows, fonts);
  } else {
    drawSupportCard(
      page,
      PREMIUM_TEMPLATE_MAP.continuation.table,
      [...supportLines, ...footerLines].length
        ? [...supportLines, ...footerLines]
        : ['No additional cost lines or trade notes are carried on this continuation page.'],
      fonts,
      12,
    );
  }
  drawFooterNotes(page, PREMIUM_TEMPLATE_MAP.continuation.footerLeft, 'Additional Clarifications', footerLines.length ? footerLines : ['No additional clarifications carried on this continuation page.'], fonts);
  drawSummaryCard(page, PREMIUM_TEMPLATE_MAP.continuation.footerCenter, model.summaryRows.slice(-3), fonts);
  drawSignatureCard(page, PREMIUM_TEMPLATE_MAP.continuation.footerRight, model, fonts, signatureImage, pageNumber, pageCount);
}

export async function renderPremiumPdf(model: EstimatePremiumRenderModel) {
  const pdf = await PDFDocument.create();
  const fonts = await loadPremiumFonts(pdf);
  const [backgroundImage, logoImage, signatureImage] = await Promise.all([
    embedImage(pdf, await loadTemplateBackgroundBytes()),
    embedImage(pdf, await loadBrandingImageBytes(model.branding.logoUrl)),
    embedImage(pdf, await loadSignatureImageBytes(model.branding.signatureImageUrl)),
  ]);

  if (!backgroundImage) {
    throw new Error('Premium template background image could not be loaded.');
  }

  const rowPages = paginateItems(model.costRows, PREMIUM_TEMPLATE_MAP.table.firstPageRows, PREMIUM_TEMPLATE_MAP.table.continuationRows);
  const supportPages = paginateItems(buildSupportLines(model), 6, 10);
  const footerPages = paginateItems(buildClarificationLines(model), 6, 8);
  const pageCount = Math.max(rowPages.length, supportPages.length, footerPages.length, 1);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([PREMIUM_TEMPLATE_PAGE.width, PREMIUM_TEMPLATE_PAGE.height]);
    const rowChunk = rowPages[pageIndex] || [];
    const supportChunk = supportPages[pageIndex] || [];
    const footerChunk = footerPages[pageIndex] || [];

    if (pageIndex === 0) {
      renderFirstPage(page, model, fonts, backgroundImage, logoImage, signatureImage, rowChunk, supportChunk, footerChunk, pageCount);
    } else {
      renderContinuationPage(page, model, fonts, backgroundImage, logoImage, signatureImage, rowChunk, supportChunk, footerChunk, pageIndex + 1, pageCount);
    }
  }

  return Buffer.from(await pdf.save());
}
