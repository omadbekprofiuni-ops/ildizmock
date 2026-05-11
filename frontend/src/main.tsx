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

// Hide the brand splash once React has mounted. Bulletproof: hard-removes
// after a timeout even if `transitionend` doesn't fire.
function hideBrandSplash() {
  const splash = document.getElementById('brand-splash')
  if (!splash) return
  splash.classList.add('is-hidden')
  // Hard fallback — fire after the CSS transition (300ms) regardless.
  window.setTimeout(() => splash.remove(), 400)
}

// Trigger as soon as React paints (next frame).
requestAnimationFrame(() => {
  // Brief flash so the logo is actually visible on fast loads.
  window.setTimeout(hideBrandSplash, 300)
})

// Belt-and-suspenders: in case the rAF path fails for any reason
// (e.g. hard error, cached load), force-remove on full window load.
window.addEventListener('load', () => {
  window.setTimeout(hideBrandSplash, 800)
})
