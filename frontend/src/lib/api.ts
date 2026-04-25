import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  withCredentials: true,
})

// SuperAdmin context switch — har request ga X-Org-Context header qo'shadi.
// Guest user — har request ga X-Guest-Token header qo'shadi (anonim attempt egasi).
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('orgContext')
    if (orgId) {
      config.headers = config.headers ?? {}
      config.headers['X-Org-Context'] = orgId
    }
    const guestToken = localStorage.getItem('ildizmock:guest-token')
    if (guestToken) {
      config.headers = config.headers ?? {}
      config.headers['X-Guest-Token'] = guestToken
    }
  }
  return config
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (!original || original._retry) return Promise.reject(error)

    // /auth/me, /auth/login, /auth/register, /auth/refresh — refresh URINMA.
    // Guest user uchun /auth/me 401 normal, infinite loop yo'q.
    const isAuthEndpoint =
      typeof original.url === 'string' &&
      (original.url.includes('/auth/login') ||
        original.url.includes('/auth/register') ||
        original.url.includes('/auth/refresh') ||
        original.url.includes('/auth/me'))

    if (error.response?.status === 401 && !isAuthEndpoint) {
      original._retry = true
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: () => resolve(api(original)),
            reject,
          })
        })
      }
      isRefreshing = true
      try {
        await api.post('/auth/refresh')
        pendingQueue.forEach(({ resolve }) => resolve())
        pendingQueue = []
        return api(original)
      } catch (refreshError) {
        pendingQueue.forEach(({ reject }) => reject(refreshError))
        pendingQueue = []

        // Soft auth clear — ProtectedRoute handles UI redirect
        try {
          const { useAuth } = await import('@/stores/auth')
          useAuth.setState({ user: null, initialised: true })
        } catch {
          /* ignore */
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)
