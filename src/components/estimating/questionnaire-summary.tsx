'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuestionnaireComputationResult } from '@/lib/estimating/questionnaire/questionnaire-types';

export function QuestionnaireSummary(props: {
  result: QuestionnaireComputationResult;
  tradeLabel: string;
}) {
  const summaryRows = [
    ['Direct Subtotal', props.result.pricingSummary.directSubtotal],
    [`Overhead (${props.result.pricingSummary.overheadPercent}%)`, props.result.pricingSummary.overheadAmount],
    [`Profit (${props.result.pricingSummary.profitPercent}%)`, props.result.pricingSummary.profitAmount],
    [`Contingency (${props.result.pricingSummary.contingencyPercent}%)`, props.result.pricingSummary.contingencyAmount],
    [`Tax (${props.result.pricingSummary.taxPercent}%)`, props.result.pricingSummary.taxAmount],
  ];

  return (
    <Card className="border-[#d9c7ac] bg-[#fffdf8]">
      <CardHeader>
        <CardTitle className="text-base text-[#213351]">Pricing Preview</CardTitle>
        <CardDescription>
          Live recalculation from the saved {props.tradeLabel.toLowerCase()} questionnaire basis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[#213351] bg-[#213351] px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">Projected Total</p>
          <p className="mt-2 text-3xl font-semibold">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(props.result.pricingSummary.total)}
          </p>
        </div>

        <div className="space-y-3">
          {summaryRows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-[#e5d9c6] px-4 py-3 text-sm">
              <span className="text-[#6a5738]">{label}</span>
              <strong className="text-[#213351]">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))}
              </strong>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a17d45]">Pricing Basis</p>
          <div className="flex flex-wrap gap-2">
            {props.result.presentation.pricingFields.map((field) => (
              <Badge key={field.label} variant="outline" className="border-[#d8c7ab] bg-[#fbf5ea] px-3 py-1 text-[#213351]">
                {field.label}: {field.value}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a17d45]">Commercial Notes</p>
          <ul className="space-y-2 text-sm leading-6 text-[#314158]">
            {props.result.presentation.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
