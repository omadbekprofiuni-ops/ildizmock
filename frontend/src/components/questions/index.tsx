import { FillBlankQuestion } from './FillBlankQuestion'
import { MCQQuestion } from './MCQQuestion'
import { MatchingQuestion } from './MatchingQuestion'
import { TFNGQuestion } from './TFNGQuestion'
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

export function QuestionRenderer(props: QuestionProps) {
  const inner = (() => {
    switch (props.question.question_type) {
      case 'mcq':
        return <MCQQuestion {...props} />
      case 'tfng':
        return <TFNGQuestion {...props} />
      case 'fill':
        return <FillBlankQuestion {...props} />
      case 'matching':
        return <MatchingQuestion {...props} />
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Question type “{props.question.question_type}” is not yet supported.
          </p>
        )
    }
  })()
  return (
    <>
      <QuestionImage url={props.question.image_url} />
      {inner}
    </>
  )
}
