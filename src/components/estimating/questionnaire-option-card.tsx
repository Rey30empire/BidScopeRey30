'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function QuestionnaireOptionCard(props: {
  label: string;
  description?: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={props.onClick} className="text-left">
      <Card className={cn(
        'h-full border-[#d8c7ab] bg-[#fffdf8] transition hover:border-[#b7925f] hover:bg-[#fff8ee]',
        props.active && 'border-[#213351] bg-[#f7ecda] shadow-sm',
      )}>
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[#213351]">{props.label}</p>
              {props.description ? <p className="mt-1 text-sm leading-6 text-[#6a5738]">{props.description}</p> : null}
            </div>
            {props.active ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#213351]" /> : null}
          </div>
          {props.hint ? <p className="text-xs uppercase tracking-[0.14em] text-[#a17d45]">{props.hint}</p> : null}
        </CardContent>
      </Card>
    </button>
  );
}
