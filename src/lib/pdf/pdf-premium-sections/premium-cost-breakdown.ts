import type { EstimateCostBreakdownRow } from '@/lib/estimates/estimate-render-model';
import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import {
  beginContinuationPage,
  drawSectionRibbon,
  drawWrappedText,
  drawWrappedTextRightAligned,
  ensurePremiumSpace,
  measureWrappedHeight,
} from '@/lib/pdf/pdf-premium-layout';

const COLUMN_WIDTHS = [80, 176, 42, 36, 56, 54, 54, 60];
const COLUMN_LABELS = ['Item', 'Description', 'Qty', 'Unit', 'Material', 'Labor', 'Equip.', 'Subtotal'];
const ROW_LINE_HEIGHT = 10.8;
const TABLE_WIDTH = COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);

function drawTableHeader(state: PremiumPdfState, y: number) {
  const x = state.tokens.contentInset;
  let cursorX = x;
  state.page.drawRectangle({
    x,
    y: y - 18,
    width: TABLE_WIDTH,
    height: 18,
    color: state.tokens.paperShade,
    borderColor: state.tokens.line,
    borderWidth: 0.5,
  });

  COLUMN_WIDTHS.forEach((width, index) => {
    state.page.drawText(COLUMN_LABELS[index] || '', {
      x: cursorX + 6,
      y: y - 12,
      font: state.fonts.sansBold,
      size: 8.4,
      color: state.tokens.ink,
    });
    if (index < COLUMN_WIDTHS.length - 1) {
      state.page.drawLine({
        start: { x: cursorX + width, y: y - 18 },
        end: { x: cursorX + width, y },
        thickness: 0.35,
        color: state.tokens.line,
      });
    }
    cursorX += width;
  });
}

function rowValues(row: EstimateCostBreakdownRow) {
  return [row.item, row.description, row.quantity, row.unit, row.material, row.labor, row.equipment, row.subtotal];
}

function measureRowHeight(state: PremiumPdfState, row: EstimateCostBreakdownRow) {
  const values = rowValues(row);
  const tallestCell = values.reduce((maxHeight, value, index) => {
    const height = measureWrappedHeight(
      index === 0 ? state.fonts.sansBold : state.fonts.sansRegular,
      8.4,
      value || '',
      COLUMN_WIDTHS[index]! - 10,
      ROW_LINE_HEIGHT,
    );
    return Math.max(maxHeight, height);
  }, 0);
  return Math.max(24, tallestCell + 10);
}

function drawRow(state: PremiumPdfState, row: EstimateCostBreakdownRow, y: number) {
  const x = state.tokens.contentInset;
  const values = rowValues(row);
  const rowHeight = measureRowHeight(state, row);
  const rightAlignedColumns = new Set([2, 4, 5, 6, 7]);
  let cursorX = x;

  state.page.drawRectangle({
    x,
    y: y - rowHeight + 6,
    width: TABLE_WIDTH,
    height: rowHeight,
    borderColor: state.tokens.line,
    borderWidth: 0.35,
    color: state.tokens.paper,
  });

  COLUMN_WIDTHS.forEach((width, index) => {
    if (index < COLUMN_WIDTHS.length - 1) {
      state.page.drawLine({
        start: { x: cursorX + width, y: y - rowHeight + 6 },
        end: { x: cursorX + width, y: y + 6 },
        thickness: 0.3,
        color: state.tokens.line,
      });
    }

    if (rightAlignedColumns.has(index)) {
      drawWrappedTextRightAligned({
        state,
        text: values[index] || '',
        x: cursorX + 5,
        y: y - 9,
        width: width - 10,
        font: index === 2 ? state.fonts.sansBold : state.fonts.sansRegular,
        size: 8.4,
        lineHeight: ROW_LINE_HEIGHT,
      });
    } else {
      drawWrappedText({
        state,
        text: values[index] || '',
        x: cursorX + 5,
        y: y - 9,
        width: width - 10,
        font: index === 0 ? state.fonts.sansBold : state.fonts.sansRegular,
        size: 8.4,
        lineHeight: ROW_LINE_HEIGHT,
      });
    }

    cursorX += width;
  });

  return rowHeight;
}

export function drawPremiumCostBreakdown(state: PremiumPdfState) {
  const firstRowHeight = state.model.costRows[0] ? measureRowHeight(state, state.model.costRows[0]) : 24;
  ensurePremiumSpace(state, firstRowHeight + 86);
  const sectionTop = state.cursorY;
  drawSectionRibbon({
    state,
    title: 'Cost Breakdown',
    x: state.tokens.contentInset,
    y: sectionTop,
    width: state.tokens.pageWidth - state.tokens.contentInset * 2,
    dark: true,
    amountText: state.model.finalTotal,
  });

  let tableY = sectionTop - 24;
  drawTableHeader(state, tableY);
  tableY -= 22;

  for (const row of state.model.costRows) {
    const rowHeight = measureRowHeight(state, row);
    if (tableY - rowHeight < 108) {
      state.cursorY = tableY;
      beginContinuationPage(state, { sectionTitle: 'Cost Breakdown' });
      drawSectionRibbon({
        state,
        title: 'Cost Breakdown Continued',
        x: state.tokens.contentInset,
        y: state.cursorY,
        width: state.tokens.pageWidth - state.tokens.contentInset * 2,
        dark: true,
        amountText: state.model.finalTotal,
      });
      tableY = state.cursorY - 24;
      drawTableHeader(state, tableY);
      tableY -= 22;
    }

    const usedHeight = drawRow(state, row, tableY);
    tableY -= usedHeight;
  }

  state.cursorY = tableY - 10;
}
