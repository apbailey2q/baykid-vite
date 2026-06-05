import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initAuth } from './lib/authInit'
import './index.css'
import App from './App.tsx'

// Initialize Supabase auth once, outside React, to avoid StrictMode double-invoke
// causing concurrent Web Lock acquisitions.
initAuth()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
