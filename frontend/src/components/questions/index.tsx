import { CompletionQuestion } from './CompletionQuestion'
import { DiagramLabelQuestion } from './DiagramLabelQuestion'
import { MCQMultiQuestion } from './MCQMultiQuestion'
import { MCQQuestion } from './MCQQuestion'
import { MatchingHeadingsQuestion } from './MatchingHeadingsQuestion'
import { MatchingItemQuestion } from './MatchingItemQuestion'
import { MatchingQuestion } from './MatchingQuestion'
import { ShortAnswerQuestion } from './ShortAnswerQuestion'
import { TFNGQuestion } from './TFNGQuestion'
import { YNNGQuestion } from './YNNGQuestion'
import type { QuestionProps } from './types'

function QuestionImage({ url }: { url?: string | null }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt="Question"
      className="mb-3 max-h-72 rounded-md border border-slate-200 object-contain"
    />
  )
}

function hasItemsPayload(question: QuestionProps['question']): boolean {
  const p = question.payload as { items?: unknown[] } | undefined
  return Array.isArray(p?.items) && p!.items!.length > 0
}

function hasDiagramPayload(question: QuestionProps['question']): boolean {
  const p = question.payload as
    | { labels?: unknown[]; image_url?: string }
    | undefined
  return Array.isArray(p?.labels) && p!.labels!.length > 0
}

export function QuestionRenderer(props: QuestionProps) {
  const { question } = props
  const inner = (() => {
    switch (question.question_type) {
      case 'mcq':
      case 'mcq_single':
        return <MCQQuestion {...props} />
      case 'multi_choice':
      case 'mcq_multi':
        return <MCQMultiQuestion {...props} />
      case 'tfng':
        return <TFNGQuestion {...props} />
      case 'ynng':
        return <YNNGQuestion {...props} />
      case 'fill':
      case 'gap_fill':
      case 'sentence_completion':
      case 'summary_completion':
      case 'form_completion':
        return <CompletionQuestion {...props} />
      case 'short_answer':
        return <ShortAnswerQuestion {...props} />
      case 'matching_headings':
        return <MatchingHeadingsQuestion {...props} />
      case 'map_labeling':
      case 'map_labelling':
      case 'diagram_label':
        return hasDiagramPayload(question) ? (
          <DiagramLabelQuestion {...props} />
        ) : (
          <MatchingItemQuestion {...props} />
        )
      case 'matching':
      case 'matching_info':
      case 'matching_features':
      case 'matching_endings':
        return hasItemsPayload(question) ? (
          <MatchingItemQuestion {...props} />
        ) : (
          <MatchingQuestion {...props} />
        )
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Question type "{question.question_type}" is not yet supported.
          </p>
        )
    }
  })()
  return (
    <>
      <QuestionImage url={question.image_url} />
      {inner}
    </>
  )
}
