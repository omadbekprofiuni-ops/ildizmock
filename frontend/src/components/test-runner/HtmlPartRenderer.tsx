import { useEffect, useMemo, useRef } from 'react'

import type { AnswerValue } from '@/components/questions/types'

interface Props {
  /** Server-rendered HTML (from `parse_content`). */
  html: string
  /** Map: question number → student's answer. */
  answers: Record<number, AnswerValue>
  /** Called when student updates an answer. */
  onAnswer: (questionNumber: number, value: AnswerValue) => void
  readOnly?: boolean
}

/**
 * ETAP 30 — examy.me uslubidagi HTML test renderer.
 *
 * Server `parse_content()` orqali generatsiya qilgan HTML'ni o'qib,
 * ichidagi `<input data-q="N"/>` va `<input type="radio" data-q="N"/>`
 * elementlarini React'ning controlled state'iga ulaydi.
 *
 * Strategiya:
 * 1. dangerouslySetInnerHTML bilan HTML'ni mount qilamiz.
 * 2. useEffect ichida har data-q[]'ga value/checked attribute beramiz va
 *    input/change listenerlarini ulaymiz.
 * 3. answers o'zgarganda inputlarni qayta sinxronlashtiramiz.
 *
 * Bu yondashuv server tomondan HTML chiqarish (full SSR-friendly) +
 * React'ning controlled-input modeli o'rtasida yagona ko'prik beradi.
 */
export function HtmlPartRenderer({ html, answers, onAnswer, readOnly }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  // Memoized HTML — agar source o'zgarmasa, dangerouslySetInnerHTML qaytarilmaydi
  const innerHtml = useMemo(() => html, [html])

  // Mount + delegated event listenerlar
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | null
      if (!t || !t.dataset || !t.dataset.q) return
      const q = Number(t.dataset.q)
      if (!Number.isFinite(q)) return
      if (t.type === 'radio') {
        onAnswerRef.current(q, t.value)
      } else {
        onAnswerRef.current(q, t.value || null)
      }
    }
    // input event'i text input uchun har keystroke'da o'tadi;
    // change event radio uchun.
    root.addEventListener('input', onChange)
    root.addEventListener('change', onChange)
    return () => {
      root.removeEventListener('input', onChange)
      root.removeEventListener('change', onChange)
    }
  }, [])

  // Answers o'zgarganda inputlarni sinxronlashtiramiz
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const inputs = root.querySelectorAll<HTMLInputElement>('input[data-q]')
    inputs.forEach((el) => {
      const q = Number(el.dataset.q)
      if (!Number.isFinite(q)) return
      const value = answers[q]
      el.disabled = !!readOnly
      if (el.type === 'radio') {
        el.checked = value != null && String(value) === el.value
      } else {
        const next = value == null ? '' : String(value)
        if (el.value !== next) el.value = next
      }
    })
  }, [answers, readOnly, innerHtml])

  return (
    <div
      ref={rootRef}
      className="html-part-renderer prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-800"
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  )
}
