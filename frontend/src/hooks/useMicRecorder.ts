import { useCallback, useRef, useState } from 'react'

interface MicRecorderState {
  recording: boolean
  blob: Blob | null
  error: string | null
}

export function useMicRecorder() {
  const [state, setState] = useState<MicRecorderState>({
    recording: false,
    blob: null,
    error: null,
  })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    setState({ recording: false, blob: null, error: null })
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, error: 'Microphone API is not available.' }))
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.start()
      recorderRef.current = rec
      setState({ recording: true, blob: null, error: null })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied.'
      setState({ recording: false, blob: null, error: msg })
      return false
    }
  }, [])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec) return resolve(null)
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        rec.stream.getTracks().forEach((t) => t.stop())
        recorderRef.current = null
        setState({ recording: false, blob, error: null })
        resolve(blob)
      }
      rec.stop()
    })
  }, [])

  const reset = useCallback(() => {
    if (recorderRef.current) {
      try {
        recorderRef.current.stop()
        recorderRef.current.stream.getTracks().forEach((t) => t.stop())
      } catch {
        /* already stopped */
      }
      recorderRef.current = null
    }
    chunksRef.current = []
    setState({ recording: false, blob: null, error: null })
  }, [])

  return {
    recording: state.recording,
    blob: state.blob,
    error: state.error,
    start,
    stop,
    reset,
  }
}
