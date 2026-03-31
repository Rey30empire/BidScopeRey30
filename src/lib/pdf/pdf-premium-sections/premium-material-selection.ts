import type { EstimatePricingField, EstimateSelectionBlock, EstimateSelectionOption } from '@/lib/estimates/estimate-render-model';
import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import {
  beginContinuationPage,
  drawPremiumPanel,
  drawSectionRibbon,
  drawWrappedText,
  drawWrappedTextRightAligned,
  ensurePremiumSpace,
  measureWrappedHeight,
} from '@/lib/pdf/pdf-premium-layout';

const SECTION_BOTTOM = 126;

function drawMaterialSectionTitle(state: PremiumPdfState) {
  const sectionTop = state.cursorY;
  const titleText = state.model.materialSectionTitle.toUpperCase();
  const titleWidth = state.fonts.serifBold.widthOfTextAtSize(titleText, 14);
  const leftX = state.tokens.contentInset;

  state.page.drawText(titleText, {
    x: state.tokens.pageWidth / 2 - titleWidth / 2,
    y: sectionTop,
    font: state.fonts.serifBold,
    size: 14,
    color: state.tokens.ink,
  });
  state.page.drawLine({
    start: { x: leftX, y: sectionTop - 3 },
    end: { x: leftX + 116, y: sectionTop - 3 },
    thickness: 0.55,
    color: state.tokens.frame,
  });
  state.page.drawLine({
    start: { x: state.tokens.pageWidth - leftX - 116, y: sectionTop - 3 },
    end: { x: state.tokens.pageWidth - leftX, y: sectionTop - 3 },
    thickness: 0.55,
    color: state.tokens.frame,
  });
}

function measureOptionBadgeHeight(state: PremiumPdfState, width: number, option: EstimateSelectionOption) {
  const innerWidth = width - 16;
  const labelHeight = measureWrappedHeight(state.fonts.sansBold, 8.8, option.label, innerWidth, 10.6);
  const descriptionHeight = option.description
    ? measureWrappedHeight(state.fonts.sansRegular, 7.9, option.description, innerWidth, 9.8)
    : 0;
  const emphasisHeight = option.emphasis ? measureWrappedHeight(state.fonts.sansBold, 7.6, option.emphasis, innerWidth, 9.2) : 0;
  return Math.max(24, 8 + labelHeight + (descriptionHeight ? descriptionHeight + 2 : 0) + (emphasisHeight ? emphasisHeight + 2 : 0) + 6);
}

function drawOptionBadge(
  state: PremiumPdfState,
  x: number,
  y: number,
  width: number,
  option: EstimateSelectionOption,
) {
  const height = measureOptionBadgeHeight(state, width, option);
  state.page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: option.active ? state.tokens.paperShade : state.tokens.paper,
    borderColor: option.active ? state.tokens.strongLine : state.tokens.line,
    borderWidth: option.active ? 0.8 : 0.45,
  });

  let textY = y - 11;
  const label = drawWrappedText({
    state,
    text: option.label,
    x: x + 8,
    y: textY,
    width: width - 16,
    font: state.fonts.sansBold,
    size: 8.8,
    lineHeight: 10.6,
  });
  textY = label.bottomY + 1;

  if (option.description) {
    const description = drawWrappedText({
      state,
      text: option.description,
      x: x + 8,
      y: textY,
      width: width - 16,
      font: state.fonts.sansRegular,
      size: 7.9,
      color: state.tokens.muted,
      lineHeight: 9.8,
    });
    textY = description.bottomY + 1;
  }

  if (option.emphasis) {
    drawWrappedText({
      state,
      text: option.emphasis,
      x: x + 8,
      y: textY,
      width: width - 16,
      font: state.fonts.sansBold,
      size: 7.6,
      color: state.tokens.accent,
      lineHeight: 9.2,
    });
  }

  return height;
}

function measureOptionGridHeight(state: PremiumPdfState, width: number, options: EstimateSelectionOption[]) {
  if (!options.length) return 0;
  const optionWidth = (width - 34) / 2;
  let total = 0;
  for (let index = 0; index < options.length; index += 2) {
    const leftHeight = measureOptionBadgeHeight(state, optionWidth, options[index]!);
    const rightHeight = options[index + 1] ? measureOptionBadgeHeight(state, optionWidth, options[index + 1]!) : 0;
    total += Math.max(leftHeight, rightHeight);
    if (index + 2 < options.length) total += 6;
  }
  return total;
}

function measureSelectionBlockHeight(state: PremiumPdfState, width: number, block: EstimateSelectionBlock) {
  const promptHeight = measureWrappedHeight(state.fonts.sansRegular, 10.2, block.prompt, width - 24, 12.5);
  const answerHeight = measureWrappedHeight(state.fonts.sansBold, 10.2, block.answer, width - 24, 12.8);
  const supportingHeight = block.supportingText
    ? measureWrappedHeight(state.fonts.sansRegular, 9, block.supportingText, width - 24, 11.2)
    : 0;
  const optionHeight = measureOptionGridHeight(state, width, block.options);
  return 34 + promptHeight + 8 + answerHeight + (supportingHeight ? supportingHeight + 8 : 0) + (optionHeight ? optionHeight + 12 : 0) + 12;
}

function drawSelectionBlock(state: PremiumPdfState, x: number, y: number, width: number, block: EstimateSelectionBlock) {
  const blockHeight = measureSelectionBlockHeight(state, width, block);
  drawPremiumPanel({ state, x, y, width, height: blockHeight });
  drawSectionRibbon({
    state,
    title: block.title,
    x: x + 1,
    y: y - 2,
    width: width - 2,
    amountText: block.amountLabel,
  });

  let cursorY = y - 34;
  const prompt = drawWrappedText({
    state,
    text: block.prompt,
    x: x + 12,
    y: cursorY,
    width: width - 24,
    font: state.fonts.sansRegular,
    size: 10.2,
    lineHeight: 12.5,
  });
  cursorY = prompt.bottomY - 2;

  const answer = drawWrappedText({
    state,
    text: block.answer,
    x: x + 12,
    y: cursorY,
    width: width - 24,
    font: state.fonts.sansBold,
    size: 10.2,
    lineHeight: 12.8,
  });
  cursorY = answer.bottomY - 2;

  if (block.supportingText) {
    const support = drawWrappedText({
      state,
      text: block.supportingText,
      x: x + 12,
      y: cursorY,
      width: width - 24,
      font: state.fonts.sansRegular,
      size: 9,
      color: state.tokens.muted,
      lineHeight: 11.2,
    });
    cursorY = support.bottomY - 4;
  }

  if (block.options.length) {
    const optionWidth = (width - 34) / 2;
    for (let index = 0; index < block.options.length; index += 2) {
      const leftOption = block.options[index]!;
      const rightOption = block.options[index + 1];
      const leftHeight = measureOptionBadgeHeight(state, optionWidth, leftOption);
      const rightHeight = rightOption ? measureOptionBadgeHeight(state, optionWidth, rightOption) : 0;
      const rowHeight = Math.max(leftHeight, rightHeight);

      drawOptionBadge(state, x + 12, cursorY, optionWidth, leftOption);
      if (rightOption) {
        drawOptionBadge(state, x + 12 + optionWidth + 10, cursorY, optionWidth, rightOption);
      }

      cursorY -= rowHeight + 6;
    }
  }

  return blockHeight;
}

function measurePricingRowHeight(state: PremiumPdfState, width: number, field: EstimatePricingField) {
  const labelWidth = width * 0.5;
  const valueWidth = width * 0.28;
  const labelHeight = measureWrappedHeight(state.fonts.sansBold, 9.2, field.label, labelWidth, 11.4);
  const valueHeight = measureWrappedHeight(state.fonts.sansRegular, 9.2, field.value, valueWidth, 11.4);
  return Math.max(labelHeight, valueHeight) + 4;
}

function fittingPricingCount(state: PremiumPdfState, width: number, fields: EstimatePricingField[], startIndex: number, availableHeight: number) {
  let usedHeight = 32;
  let count = 0;
  for (let index = startIndex; index < fields.length; index += 1) {
    const rowHeight = measurePricingRowHeight(state, width, fields[index]!);
    const nextHeight = usedHeight + rowHeight;
    if (count > 0 && nextHeight + 12 > availableHeight) break;
    if (count === 0 && nextHeight + 12 > availableHeight) return 0;
    usedHeight = nextHeight;
    count += 1;
  }
  return count;
}

function drawPricingPanel(
  state: PremiumPdfState,
  x: number,
  y: number,
  width: number,
  fields: EstimatePricingField[],
  continued: boolean,
) {
  const bodyHeight = fields.reduce((total, field) => total + measurePricingRowHeight(state, width - 24, field), 0);
  const height = 32 + bodyHeight + 12;
  drawPremiumPanel({ state, x, y, width, height });
  drawSectionRibbon({
    state,
    title: continued ? 'Pricing Method Continued' : 'Pricing Method',
    x: x + 1,
    y: y - 2,
    width: width - 2,
  });

  let cursorY = y - 32;
  for (const field of fields) {
    const rowHeight = measurePricingRowHeight(state, width - 24, field);
    drawWrappedText({
      state,
      text: field.label,
      x: x + 12,
      y: cursorY,
      width: width * 0.5,
      font: state.fonts.sansBold,
      size: 9.2,
      lineHeight: 11.4,
    });
    drawWrappedTextRightAligned({
      state,
      text: field.value,
      x: x + width - width * 0.28 - 12,
      y: cursorY,
      width: width * 0.28,
      font: state.fonts.sansRegular,
      size: 9.2,
      lineHeight: 11.4,
    });
    cursorY -= rowHeight;
  }

  return height;
}

function measureNoteHeight(state: PremiumPdfState, width: number, note: string) {
  return measureWrappedHeight(state.fonts.sansRegular, 9.4, `› ${note}`, width - 24, 11.8) + 4;
}

function fittingNoteCount(state: PremiumPdfState, width: number, notes: string[], startIndex: number, availableHeight: number) {
  let usedHeight = 32;
  let count = 0;
  for (let index = startIndex; index < notes.length; index += 1) {
    const noteHeight = measureNoteHeight(state, width, notes[index]!);
    const nextHeight = usedHeight + noteHeight;
    if (count > 0 && nextHeight + 12 > availableHeight) break;
    if (count === 0 && nextHeight + 12 > availableHeight) return 0;
    usedHeight = nextHeight;
    count += 1;
  }
  return count;
}

function drawNotesPanel(state: PremiumPdfState, x: number, y: number, width: number, notes: string[], continued: boolean) {
  const bodyHeight = notes.reduce((total, note) => total + measureNoteHeight(state, width, note), 0);
  const height = 32 + bodyHeight + 12;
  drawPremiumPanel({ state, x, y, width, height });
  drawSectionRibbon({
    state,
    title: continued ? 'Cost Breakdown Continued' : 'Cost Breakdown',
    x: x + 1,
    y: y - 2,
    width: width - 2,
  });

  let cursorY = y - 32;
  for (const note of notes) {
    drawWrappedText({
      state,
      text: `› ${note}`,
      x: x + 12,
      y: cursorY,
      width: width - 24,
      font: state.fonts.sansRegular,
      size: 9.4,
      lineHeight: 11.8,
    });
    cursorY -= measureNoteHeight(state, width, note);
  }

  return height;
}

export function drawPremiumMaterialSelection(state: PremiumPdfState) {
  ensurePremiumSpace(state, 180);

  const fullWidth = state.tokens.pageWidth - state.tokens.contentInset * 2;
  const leftX = state.tokens.contentInset;
  const rightX = state.tokens.contentInset + fullWidth * 0.55;
  const leftWidth = fullWidth * 0.5 - 8;
  const rightWidth = fullWidth * 0.45 - 8;
  const blocks = state.model.materialSelectionBlocks;
  const pricingFields = state.model.pricingFields;
  const notes = state.model.costBreakdownNotes;

  let blockIndex = 0;
  let pricingIndex = 0;
  let noteIndex = 0;
  let firstPage = true;
  let leftY = state.cursorY;
  let rightY = state.cursorY;

  const startPage = () => {
    if (!firstPage) {
      beginContinuationPage(state, { sectionTitle: state.model.materialSectionTitle });
    }
    drawMaterialSectionTitle(state);
    leftY = state.cursorY - 20;
    rightY = state.cursorY - 20;
    firstPage = false;
  };

  startPage();

  while (blockIndex < blocks.length || pricingIndex < pricingFields.length || noteIndex < notes.length) {
    const hasLeftRemaining = blockIndex < blocks.length;
    const hasRightRemaining = pricingIndex < pricingFields.length || noteIndex < notes.length;
    const leftPageStart = leftY;
    const rightPageStart = rightY;

    if (hasLeftRemaining && hasRightRemaining) {
      while (blockIndex < blocks.length) {
        const block = blocks[blockIndex]!;
        const height = measureSelectionBlockHeight(state, leftWidth, block);
        if (leftY - height < SECTION_BOTTOM && leftY !== leftPageStart) break;
        const usedHeight = drawSelectionBlock(state, leftX, leftY, leftWidth, block);
        leftY -= usedHeight + 12;
        blockIndex += 1;
        if (leftY < SECTION_BOTTOM) break;
      }

      if (pricingIndex < pricingFields.length) {
        const availableHeight = rightY - SECTION_BOTTOM;
        const count = fittingPricingCount(state, rightWidth, pricingFields, pricingIndex, availableHeight);
        if (count > 0) {
          const panelHeight = drawPricingPanel(
            state,
            rightX,
            rightY,
            rightWidth,
            pricingFields.slice(pricingIndex, pricingIndex + count),
            pricingIndex > 0,
          );
          rightY -= panelHeight + 12;
          pricingIndex += count;
        }
      }

      if (noteIndex < notes.length) {
        const availableHeight = rightY - SECTION_BOTTOM;
        const count = fittingNoteCount(state, rightWidth, notes, noteIndex, availableHeight);
        if (count > 0) {
          const panelHeight = drawNotesPanel(
            state,
            rightX,
            rightY,
            rightWidth,
            notes.slice(noteIndex, noteIndex + count),
            noteIndex > 0,
          );
          rightY -= panelHeight + 12;
          noteIndex += count;
        }
      }
    } else if (hasLeftRemaining) {
      rightY = leftY;
      while (blockIndex < blocks.length) {
        const block = blocks[blockIndex]!;
        const height = measureSelectionBlockHeight(state, fullWidth, block);
        if (leftY - height < SECTION_BOTTOM && leftY !== leftPageStart) break;
        const usedHeight = drawSelectionBlock(state, leftX, leftY, fullWidth, block);
        leftY -= usedHeight + 12;
        blockIndex += 1;
        if (leftY < SECTION_BOTTOM) break;
      }
      rightY = leftY;
    } else {
      leftY = rightY;

      if (pricingIndex < pricingFields.length) {
        const availableHeight = rightY - SECTION_BOTTOM;
        const count = fittingPricingCount(state, fullWidth, pricingFields, pricingIndex, availableHeight);
        if (count > 0) {
          const panelHeight = drawPricingPanel(
            state,
            leftX,
            rightY,
            fullWidth,
            pricingFields.slice(pricingIndex, pricingIndex + count),
            pricingIndex > 0,
          );
          rightY -= panelHeight + 12;
          pricingIndex += count;
        }
      }

      if (noteIndex < notes.length) {
        const availableHeight = rightY - SECTION_BOTTOM;
        const count = fittingNoteCount(state, fullWidth, notes, noteIndex, availableHeight);
        if (count > 0) {
          const panelHeight = drawNotesPanel(
            state,
            leftX,
            rightY,
            fullWidth,
            notes.slice(noteIndex, noteIndex + count),
            noteIndex > 0,
          );
          rightY -= panelHeight + 12;
          noteIndex += count;
        }
      }

      leftY = rightY;
    }

    if (blockIndex >= blocks.length && pricingIndex >= pricingFields.length && noteIndex >= notes.length) {
      break;
    }

    if (leftY === leftPageStart && rightY === rightPageStart) {
      break;
    }

    state.cursorY = Math.min(leftY, rightY);
    startPage();
  }

  state.cursorY = Math.min(leftY, rightY) - 6;
}
