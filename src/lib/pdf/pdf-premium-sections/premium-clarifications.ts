import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { beginContinuationPage, drawPremiumPanel, drawSectionRibbon, drawWrappedText, measureWrappedHeight } from '@/lib/pdf/pdf-premium-layout';

const CLARIFICATION_LINE_HEIGHT = 12.5;
const CLARIFICATION_BOTTOM = 104;

function clarificationItems(state: PremiumPdfState) {
  return [...state.model.clarifications, ...state.model.qualifications];
}

export function measureClarificationsHeight(state: PremiumPdfState, width: number, items = clarificationItems(state)) {
  const itemHeight = items.reduce(
    (total, item) => total + measureWrappedHeight(state.fonts.sansRegular, 9.3, `- ${item}`, width - 24, CLARIFICATION_LINE_HEIGHT) + 6,
    0,
  );
  return Math.max(114, 30 + itemHeight + 12);
}

function fittingClarificationCount(state: PremiumPdfState, width: number, items: string[], startIndex: number, availableHeight: number) {
  let usedHeight = 30;
  let count = 0;
  for (let index = startIndex; index < items.length; index += 1) {
    const itemHeight = measureWrappedHeight(state.fonts.sansRegular, 9.3, `- ${items[index]}`, width - 24, CLARIFICATION_LINE_HEIGHT) + 6;
    const nextHeight = usedHeight + itemHeight + 12;
    if (count > 0 && nextHeight > availableHeight) break;
    if (count === 0 && nextHeight > availableHeight) return 0;
    usedHeight += itemHeight;
    count += 1;
  }
  return count;
}

export function drawPremiumClarifications(input: {
  state: PremiumPdfState;
  x: number;
  y: number;
  width: number;
  title?: string;
  items?: string[];
}) {
  const { state, x, y, width } = input;
  const items = input.items ?? clarificationItems(state);
  const height = measureClarificationsHeight(state, width, items);

  drawPremiumPanel({ state, x, y, width, height });
  drawSectionRibbon({
    state,
    title: input.title ?? 'Clarifications & Qualifications',
    x: x + 1,
    y: y - 2,
    width: width - 2,
    dark: true,
  });

  let cursorY = y - 32;
  for (const item of items) {
    drawWrappedText({
      state,
      text: `- ${item}`,
      x: x + 12,
      y: cursorY,
      width: width - 24,
      font: state.fonts.sansRegular,
      size: 9.3,
      lineHeight: CLARIFICATION_LINE_HEIGHT,
    });
    cursorY -= measureWrappedHeight(state.fonts.sansRegular, 9.3, `- ${item}`, width - 24, CLARIFICATION_LINE_HEIGHT) + 6;
  }

  return height;
}

export function drawPremiumClarificationsFlow(input: {
  state: PremiumPdfState;
  x: number;
  y: number;
  width: number;
}) {
  const { state, x, width } = input;
  const items = clarificationItems(state);
  let cursorY = input.y;
  let index = 0;

  while (index < items.length) {
    const availableHeight = cursorY - CLARIFICATION_BOTTOM;
    const count = fittingClarificationCount(state, width, items, index, availableHeight);
    if (count === 0) {
      beginContinuationPage(state, { sectionTitle: 'Clarifications & Qualifications' });
      cursorY = state.cursorY;
      continue;
    }

    const subset = items.slice(index, index + count);
    const usedHeight = drawPremiumClarifications({
      state,
      x,
      y: cursorY,
      width,
      title: index > 0 ? 'Clarifications & Qualifications Continued' : 'Clarifications & Qualifications',
      items: subset,
    });
    cursorY -= usedHeight + 12;
    index += count;

    if (index < items.length) {
      beginContinuationPage(state, { sectionTitle: 'Clarifications & Qualifications' });
      cursorY = state.cursorY;
    }
  }

  return cursorY;
}
