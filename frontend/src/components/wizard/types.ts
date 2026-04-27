export type WizardModule = 'listening' | 'reading' | 'writing' | 'full_mock'

export interface WizardData {
  module: WizardModule
  name: string
  difficulty: 'easy' | 'medium' | 'hard'
  test_type: 'academic' | 'general'
  description: string
  category: string
  duration_minutes: number
}

export interface ListeningPart {
  id: number
  part_number: number
  audio_url: string | null
  audio_duration_seconds: number
  audio_bitrate_kbps: number
  audio_size_bytes: number
  transcript: string
  instructions: string
  questions: WizardQuestion[]
}

export interface WizardPassage {
  id: number
  section_number: number
  title: string
  subtitle: string
  body_text: string
  instructions: string
  questions: WizardQuestion[]
}

export interface WritingTask {
  id: number
  task_number: number
  prompt: string
  chart_image_url: string | null
  min_words: number
  suggested_minutes: number
  requirements: string
}

export interface WizardQuestion {
  id?: number
  question_number: number
  question_type: string
  prompt: string
  options: Record<string, unknown>
  correct_answer: Record<string, unknown>
  alt_answers: string[]
  points: number
}

export interface WizardTestDetail {
  id: string
  name: string
  module: WizardModule
  difficulty: string
  test_type: string
  status: string
  description: string
  category: string
  duration_minutes: number
  is_global: boolean
  cloned_from: string | null
  questions_count: number
  listening_parts: ListeningPart[]
  passages: WizardPassage[]
  writing_tasks: WritingTask[]
}
