import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 min default
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// Hide the brand splash once React has mounted (gives the logo a brief
// flash on every refresh — defined in index.html).
requestAnimationFrame(() => {
  const splash = document.getElementById('brand-splash')
  if (!splash) return
  // Keep the splash on screen for at least 600ms so it doesn't vanish
  // instantly on cached loads.
  setTimeout(() => {
    splash.classList.add('is-hidden')
    splash.addEventListener('transitionend', () => splash.remove(), {
      once: true,
    })
  }, 600)
})
