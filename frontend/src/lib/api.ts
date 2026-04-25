import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  withCredentials: true,
})

// SuperAdmin context switch — har request ga X-Org-Context header qo'shadi
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('orgContext')
    if (orgId) {
      config.headers = config.headers ?? {}
      config.headers['X-Org-Context'] = orgId
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

    const isAuthEndpoint =
      typeof original.url === 'string' &&
      (original.url.includes('/auth/login') ||
        original.url.includes('/auth/register') ||
        original.url.includes('/auth/refresh'))

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

        // Clear auth store softly (no full page reload) — ProtectedRoute handles redirect
        try {
          const { useAuth } = await import('@/stores/auth')
          useAuth.setState({ user: null, initialised: true })
        } catch {
          /* ignore — module not yet loaded */
        }

        // Fallback hard redirect only if app router hasn't caught it yet
        // and we're not already on a public auth page.
        const path = window.location.pathname
        if (path !== '/login' && path !== '/register') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)
