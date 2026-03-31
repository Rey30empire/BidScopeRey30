'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  QuestionnaireAnswerMap,
  QuestionnaireBooleanQuestion,
  QuestionnaireNumberQuestion,
  QuestionnaireQuestion,
  QuestionnaireSelectQuestion,
  QuestionnaireSection,
} from '@/lib/estimating/questionnaire/questionnaire-types';
import { QuestionnaireOptionCard } from '@/components/estimating/questionnaire-option-card';

function getSelectValue(answers: QuestionnaireAnswerMap, question: QuestionnaireSelectQuestion) {
  return typeof answers[question.id] === 'string' ? answers[question.id] as string : question.defaultValue;
}

function getNumberValue(answers: QuestionnaireAnswerMap, question: QuestionnaireNumberQuestion) {
  return typeof answers[question.id] === 'number' ? answers[question.id] as number : question.defaultValue;
}

function getBooleanValue(answers: QuestionnaireAnswerMap, question: QuestionnaireBooleanQuestion) {
  return typeof answers[question.id] === 'boolean' ? answers[question.id] as boolean : question.defaultValue;
}

export function QuestionnaireSectionView(props: {
  section: QuestionnaireSection;
  answers: QuestionnaireAnswerMap;
  onChange: (questionId: string, value: string | number | boolean) => void;
}) {
  return (
    <div className="space-y-6 rounded-[28px] border border-[#d9c8ac] bg-[#fffdf8] p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a17d45]">{props.section.title}</p>
        {props.section.description ? <p className="max-w-3xl text-sm leading-6 text-[#6a5738]">{props.section.description}</p> : null}
      </div>

      <div className="space-y-6">
        {props.section.questions.map((question) => (
          <div key={question.id} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-[#213351]">{question.label}</Label>
              {question.description ? <p className="text-sm leading-6 text-[#6a5738]">{question.description}</p> : null}
            </div>

            {question.type === 'single_select' ? (
              <div className={question.displayStyle === 'cards' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}>
                {question.options.map((option) => (
                  <QuestionnaireOptionCard
                    key={option.value}
                    label={option.label}
                    description={option.description}
                    hint={option.hint}
                    active={getSelectValue(props.answers, question) === option.value}
                    onClick={() => props.onChange(question.id, option.value)}
                  />
                ))}
              </div>
            ) : null}

            {question.type === 'boolean' ? (
              <label className="flex items-center gap-3 rounded-2xl border border-[#d8c7ab] bg-[#fffaf1] px-4 py-3">
                <Checkbox
                  checked={getBooleanValue(props.answers, question)}
                  onCheckedChange={(checked) => props.onChange(question.id, Boolean(checked))}
                />
                <span className="text-sm text-[#314158]">{question.helpText || 'Enable this estimating carry.'}</span>
              </label>
            ) : null}

            {question.type === 'number' ? (
              <div className="max-w-[220px]">
                <Input
                  type="number"
                  min={question.min}
                  max={question.max}
                  step={question.step ?? 1}
                  value={getNumberValue(props.answers, question)}
                  onChange={(event) => props.onChange(question.id, Number(event.target.value || 0))}
                  className="border-[#d8c7ab] bg-white"
                />
                {question.suffix ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#a17d45]">{question.suffix}</p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
