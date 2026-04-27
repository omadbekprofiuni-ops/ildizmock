import { FillBlankQuestion } from './FillBlankQuestion'
import { MCQQuestion } from './MCQQuestion'
import { MatchingQuestion } from './MatchingQuestion'
import { TFNGQuestion } from './TFNGQuestion'
import type { QuestionProps } from './types'

export function QuestionRenderer(props: QuestionProps) {
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
}
