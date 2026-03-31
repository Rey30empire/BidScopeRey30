import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { drawPremiumPanel, drawWrappedText, measureWrappedHeight, wrapText } from '@/lib/pdf/pdf-premium-layout';

export function drawPremiumProjectInfo(state: PremiumPdfState) {
  const panelTop = state.cursorY;
  const leftX = state.tokens.contentInset;
  const width = state.tokens.pageWidth - state.tokens.contentInset * 2;
  const leftColX = leftX + 14;
  const rightColX = leftX + width * 0.58;
  const leftLabelWidth = 74;
  const rightLabelWidth = 102;
  const leftValueWidth = width * 0.47 - 84;
  const rightValueWidth = leftX + width - 14 - (rightColX + rightLabelWidth);
  const rowGap = 4;
  const leftContentHeight = state.model.infoLeft.reduce((total, field) => {
    const valueHeight = measureWrappedHeight(state.fonts.sansRegular, 10.2, field.value, leftValueWidth, 12.5);
    return total + Math.max(12.5, valueHeight) + rowGap;
  }, 0);
  const rightContentHeight = state.model.infoRight.reduce((total, field) => {
    const valueHeight = measureWrappedHeight(state.fonts.sansRegular, 10.2, field.value, rightValueWidth, 12.5);
    return total + Math.max(12.5, valueHeight) + rowGap;
  }, 0);
  const bidDueDateValue = state.model.infoLeft.find((item) => item.label === 'Bid due date')?.value ?? '';
  const bidDueDateHeight = measureWrappedHeight(state.fonts.sansRegular, 10, bidDueDateValue, width * 0.33 - 92, 12.2);
  const dueDateBoxHeight = Math.max(24, 14 + bidDueDateHeight);
  const panelHeight = Math.max(124, 22 + Math.max(leftContentHeight, rightContentHeight + dueDateBoxHeight + 12) + 12);

  drawPremiumPanel({
    state,
    x: leftX,
    y: panelTop,
    width,
    height: panelHeight,
  });

  let leftY = panelTop - 18;
  for (const field of state.model.infoLeft) {
    state.page.drawText(field.label, {
      x: leftColX,
      y: leftY,
      font: state.fonts.sansBold,
      size: 10.2,
      color: state.tokens.ink,
    });
    drawWrappedText({
      state,
      text: field.value,
      x: leftColX + leftLabelWidth,
      y: leftY,
      width: leftValueWidth,
      font: state.fonts.sansRegular,
      size: 10.2,
    });
    leftY -= Math.max(12.5, measureWrappedHeight(state.fonts.sansRegular, 10.2, field.value, leftValueWidth, 12.5)) + rowGap;
  }

  state.page.drawLine({
    start: { x: rightColX - 10, y: panelTop - 8 },
    end: { x: rightColX - 10, y: panelTop - panelHeight + 12 },
    thickness: 0.45,
    color: state.tokens.line,
  });

  let rightY = panelTop - 18;
  for (const field of state.model.infoRight) {
    state.page.drawText(`• ${field.label}`, {
      x: rightColX,
      y: rightY,
      font: state.fonts.sansBold,
      size: 10.2,
      color: state.tokens.ink,
    });
    drawWrappedText({
      state,
      text: field.value,
      x: rightColX + rightLabelWidth,
      y: rightY,
      width: rightValueWidth,
      font: state.fonts.sansRegular,
      size: 10.2,
    });
    rightY -= Math.max(12.5, measureWrappedHeight(state.fonts.sansRegular, 10.2, field.value, rightValueWidth, 12.5)) + rowGap;
  }

  state.page.drawRectangle({
    x: rightColX,
    y: panelTop - panelHeight + 10,
    width: width * 0.33,
    height: dueDateBoxHeight,
    borderColor: state.tokens.line,
    borderWidth: 0.55,
    color: state.tokens.paper,
  });
  state.page.drawText('Bid due date', {
    x: rightColX + 10,
    y: panelTop - panelHeight + dueDateBoxHeight - 2,
    font: state.fonts.sansBold,
    size: 10,
    color: state.tokens.muted,
  });
  drawWrappedText({
    state,
    text: bidDueDateValue,
    x: rightColX + 78,
    y: panelTop - panelHeight + dueDateBoxHeight - 2,
    width: width * 0.33 - 92,
    font: state.fonts.sansRegular,
    size: 10,
  });

  const noteY = panelTop - panelHeight - 14;
  const noteWidth = width - 40;
  const noteSize = 10;
  const noteLines = wrapText(state.fonts.sansRegular, noteSize, state.model.preliminaryNote, noteWidth);
  const notePanelHeight = Math.max(26, noteLines.length * 11.6 + 12);
  drawPremiumPanel({
    state,
    x: leftX + 4,
    y: noteY,
    width: width - 8,
    height: notePanelHeight,
    fill: state.tokens.paper,
  });
  let noteTextY = noteY - 16;
  for (const line of noteLines) {
    const centeredWidth = state.fonts.sansRegular.widthOfTextAtSize(line, noteSize);
    state.page.drawText(line, {
      x: state.tokens.pageWidth / 2 - centeredWidth / 2,
      y: noteTextY,
      font: state.fonts.sansRegular,
      size: noteSize,
      color: state.tokens.muted,
    });
    noteTextY -= 11.6;
  }

  state.cursorY = noteY - notePanelHeight - 10;
}
