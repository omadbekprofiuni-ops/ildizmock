export type QuestionType =
  | 'mcq'
  | 'mcq_single'
  | 'multi_choice'
  | 'mcq_multi'
  | 'tfng'
  | 'ynng'
  | 'fill'
  | 'gap_fill'
  | 'matching'
  | 'matching_headings'
  | 'matching_info'
  | 'matching_features'
  | 'matching_endings'
  | 'short_answer'
  | 'form_completion'
  | 'sentence_completion'
  | 'summary_completion'
  | 'map_labeling'
  | 'map_labelling'
  | 'diagram_label'

export type QuestionData = {
  id: number
  order: number
  question_type: QuestionType
  text: string
  prompt?: string
  options: string[]
  group_id: number
  instruction: string
  points: number
  image_url?: string | null
  /** Smart-Paste payload (per ETAP 24/25). Undefined for legacy questions. */
  payload?: Record<string, unknown>
}

export type AnswerValue =
  | string
  | string[]
  | Record<string, string>
  | null

export type QuestionProps = {
  question: QuestionData
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  number: number
  readOnly?: boolean
}
