/**
 * Guest (anonymous) urinishlar localStorage'da saqlanadi.
 * Foydalanuvchi auth qilmasdan test topshirsa, attempt UUID'sini eslab qolish
 * va HomePage'da "Mening anonim natijalarim" ko'rsatish uchun.
 */

const KEY = 'ieltsation:guest-attempts'

export type GuestAttemptRecord = {
  id: string
  test_id: string
  test_name: string
  module: 'listening' | 'reading' | 'writing' | 'speaking'
  started_at: string  // ISO
  status: 'in_progress' | 'graded' | 'submitted'
  band_score?: string | null
}

function read(): GuestAttemptRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(items: GuestAttemptRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* quota exceeded — ignore */
  }
}

export const guestAttempts = {
  list(): GuestAttemptRecord[] {
    return read().sort((a, b) => b.started_at.localeCompare(a.started_at))
  },
  add(rec: GuestAttemptRecord) {
    const all = read()
    const idx = all.findIndex((r) => r.id === rec.id)
    if (idx >= 0) all[idx] = rec
    else all.push(rec)
    write(all.slice(-20)) // ko'pi bilan 20
  },
  update(id: string, patch: Partial<GuestAttemptRecord>) {
    const all = read()
    const idx = all.findIndex((r) => r.id === id)
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch }
      write(all)
    }
  },
  remove(id: string) {
    write(read().filter((r) => r.id !== id))
  },
  clear() {
    write([])
  },
}
