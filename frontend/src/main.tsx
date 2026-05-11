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

// Splash CSS animation 1.4s'da o'z-o'zidan o'chadi (index.html). Bu yerda
// React mount bo'lganda ertaroq (250ms) dismiss qilamiz.
requestAnimationFrame(() => {
  window.setTimeout(() => {
    const hide = (window as { __hideBrandSplash?: () => void }).__hideBrandSplash
    if (typeof hide === 'function') hide()
  }, 250)
})
