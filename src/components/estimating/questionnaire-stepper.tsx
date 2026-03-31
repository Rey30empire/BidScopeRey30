'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuestionnaireSection } from '@/lib/estimating/questionnaire/questionnaire-types';

export function QuestionnaireStepper(props: {
  sections: QuestionnaireSection[];
  currentSectionId: string;
  answersCountBySection: Record<string, number>;
  onSelect: (sectionId: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {props.sections.map((section, index) => {
        const active = section.id === props.currentSectionId;
        const answered = props.answersCountBySection[section.id] || 0;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => props.onSelect(section.id)}
            className={cn(
              'rounded-2xl border px-4 py-4 text-left transition',
              active
                ? 'border-[#213351] bg-[#213351] text-white'
                : 'border-slate-200 bg-white hover:border-[#b7925f] hover:bg-[#fffaf1]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', active ? 'text-white/70' : 'text-[#a17d45]')}>
                  Step {index + 1}
                </p>
                <p className="mt-2 text-base font-semibold">{section.title}</p>
              </div>
              <Badge className={cn(active ? 'border-white/10 bg-white/10 text-white' : 'bg-slate-100 text-slate-700')}>
                {answered}/{section.questions.length}
              </Badge>
            </div>
            {section.description ? (
              <p className={cn('mt-3 text-sm leading-6', active ? 'text-white/80' : 'text-slate-600')}>
                {section.description}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
