'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionnaireSectionView } from '@/components/estimating/questionnaire-section';
import { QuestionnaireStepper } from '@/components/estimating/questionnaire-stepper';
import { QuestionnaireSummary } from '@/components/estimating/questionnaire-summary';
import { applyEstimateQuestionnairePricing } from '@/lib/estimating/questionnaire/estimate-pricing-engine';
import type {
  EstimateQuestionnaireState,
  QuestionnaireAnswerMap,
  QuestionnaireApiResponse,
  QuestionnaireQuestion,
  QuestionnaireSection,
  QuestionnaireTemplate,
} from '@/lib/estimating/questionnaire/questionnaire-types';

function countAnswered(section: QuestionnaireSection, answers: QuestionnaireAnswerMap) {
  return section.questions.reduce((count, question) => {
    const value = answers[question.id];
    if (question.type === 'boolean') {
      return typeof value === 'boolean' ? count + 1 : count;
    }
    if (question.type === 'number') {
      return typeof value === 'number' ? count + 1 : count;
    }
    return typeof value === 'string' && value.trim() ? count + 1 : count;
  }, 0);
}

function buildLocalState(state: EstimateQuestionnaireState, answers: QuestionnaireAnswerMap): EstimateQuestionnaireState {
  return {
    ...state,
    answers,
  };
}

export function EstimateQuestionnaire(props: {
  estimateId: string;
  onEstimateApplied: (estimate: unknown) => void;
}) {
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [state, setState] = useState<EstimateQuestionnaireState | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswerMap>({});
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/estimates/${props.estimateId}/questionnaire`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.template || !payload?.state) {
          throw new Error(payload?.error || 'Failed to load estimate questionnaire');
        }
        if (cancelled) return;
        const parsed = payload as QuestionnaireApiResponse;
        setTemplate(parsed.template);
        setState(parsed.state);
        setAnswers(parsed.state.answers);
        setActiveSectionId(parsed.template.sections[0]?.id || '');
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load estimate questionnaire');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.estimateId]);

  const preview = useMemo(() => {
    if (!state) return null;
    return applyEstimateQuestionnairePricing(buildLocalState(state, answers));
  }, [answers, state]);

  const answersCountBySection = useMemo(() => {
    if (!template) return {};
    return Object.fromEntries(template.sections.map((section) => [section.id, countAnswered(section, answers)]));
  }, [answers, template]);

  const currentSection = template?.sections.find((section) => section.id === activeSectionId) || template?.sections[0] || null;

  const updateAnswer = (questionId: string, value: string | number | boolean) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const saveAnswers = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/estimates/${props.estimateId}/questionnaire`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.questionnaire?.state || !payload?.estimate) {
        throw new Error(payload?.error || 'Failed to save estimate questionnaire');
      }

      const nextQuestionnaire = payload.questionnaire as QuestionnaireApiResponse;
      setTemplate(nextQuestionnaire.template);
      setState(nextQuestionnaire.state);
      setAnswers(nextQuestionnaire.state.answers);
      props.onEstimateApplied(payload.estimate);
      toast.success('Questionnaire saved and estimate recalculated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save estimate questionnaire');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">Loading trade questionnaire...</CardContent>
      </Card>
    );
  }

  if (!template || !state || !preview || !currentSection) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">Questionnaire unavailable for this estimate.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-[#d7c6aa]">
        <CardHeader className="bg-[linear-gradient(135deg,#fffaf1,#f5ecdb)]">
          <CardTitle className="text-base text-[#213351]">{template.tradeLabel} Intelligent Estimate Questionnaire</CardTitle>
          <CardDescription>{template.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <QuestionnaireStepper
            sections={template.sections}
            currentSectionId={currentSection.id}
            answersCountBySection={answersCountBySection}
            onSelect={setActiveSectionId}
          />

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <QuestionnaireSectionView section={currentSection} answers={answers} onChange={updateAnswer} />
            <QuestionnaireSummary result={preview} tradeLabel={template.tradeLabel} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              This questionnaire now drives the estimate basis. Saving it recalculates pricing and resets manual approvals for review.
            </p>
            <Button onClick={saveAnswers} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Questionnaire
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
