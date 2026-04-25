import { create } from 'zustand'

type State = {
  orgId: number | null
  orgName: string | null
  setContext: (id: number | null, name: string | null) => void
}

const KEY_ID = 'orgContext'
const KEY_NAME = 'orgContextName'

export const useOrgContext = create<State>((set) => ({
  orgId: (() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY_ID) : null
    return raw ? Number(raw) : null
  })(),
  orgName: typeof window !== 'undefined' ? localStorage.getItem(KEY_NAME) : null,
  setContext: (id, name) => {
    if (id) {
      localStorage.setItem(KEY_ID, String(id))
      localStorage.setItem(KEY_NAME, name || '')
    } else {
      localStorage.removeItem(KEY_ID)
      localStorage.removeItem(KEY_NAME)
    }
    set({ orgId: id, orgName: name })
  },
}))
