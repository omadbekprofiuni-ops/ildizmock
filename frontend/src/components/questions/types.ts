export type QuestionData = {
  id: number
  order: number
  question_type: 'mcq' | 'tfng' | 'fill' | 'matching'
  text: string
  options: string[]
  group_id: number
  instruction: string
  points: number
  image_url?: string | null
}

export type AnswerValue = string | null

export type QuestionProps = {
  question: QuestionData
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  number: number
  readOnly?: boolean
}
