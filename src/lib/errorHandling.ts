// errorHandling.ts — Production-grade error handling utilities
// BayKid AI Marketing Center
//
// Provides:
//   withRetry()        — exponential-backoff retry for async operations
//   useAsyncAction()   — React hook wrapping async calls with loading/error state
//   sanitizeContent()  — strip HTML/scripts from AI-generated content
//   validateInput()    — field validation with rules
//   RateLimiter        — token-bucket rate limiting (client-side)
//   usePaginatedData() — pagination hook
//   useDebounceValue() — debounce hook for filter inputs

import { useState, useCallback, useRef, useMemo } from 'react'

// ── Retry with exponential backoff ────────────────────────────────────────────

export interface RetryOptions {
  maxRetries?: number      // default 3
  baseDelayMs?: number     // default 500
  maxDelayMs?:  number     // default 10000
  shouldRetry?: (err: unknown, attempt: number) => boolean
  onRetry?:     (attempt: number, err: unknown) => void
}

export async function withRetry<T>(
  fn:      () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs  = 10_000,
    shouldRetry = () => true,
    onRetry,
  } = options

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxRetries) break
      if (!shouldRetry(err, attempt)) break
      onRetry?.(attempt + 1, err)
      const jitter = Math.random() * 200
      const delay  = Math.min(baseDelayMs * Math.pow(2, attempt) + jitter, maxDelayMs)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ── useAsyncAction hook ───────────────────────────────────────────────────────

export interface AsyncActionState<T> {
  data:    T | null
  loading: boolean
  error:   string | null
  execute: (...args: unknown[]) => Promise<T | null>
  reset:   () => void
}

export function useAsyncAction<T>(
  fn:      (...args: unknown[]) => Promise<T>,
  options?: {
    retries?:       number
    onSuccess?:     (data: T) => void
    onError?:       (err: string) => void
    errorFallback?: (err: unknown) => string
  },
): AsyncActionState<T> {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await withRetry(
        () => fnRef.current(...args),
        { maxRetries: options?.retries ?? 0 },
      )
      setData(result)
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const msg = options?.errorFallback?.(err) ??
        (err instanceof Error ? err.message : String(err))
      setError(msg)
      options?.onError?.(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [options])

  const reset = useCallback(() => { setData(null); setError(null); setLoading(false) }, [])

  return { data, loading, error, execute, reset }
}

// ── Content sanitization ──────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,           // onclick=, onerror=, etc.
  /<\s*\/?\s*(script|iframe|object|embed|form|input|button)[^>]*>/gi,
  /data:text\/html/gi,
]

/** Strip dangerous HTML/script content from AI-generated text. Returns sanitized string. */
export function sanitizeContent(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let clean = text
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '')
  }
  // Collapse triple+ newlines to double
  clean = clean.replace(/\n{3,}/g, '\n\n')
  return clean.trim()
}

/** Check if content was altered by sanitization */
export function wasSanitized(original: string, sanitized: string): boolean {
  return original.trim() !== sanitized.trim()
}

// ── Input validation ──────────────────────────────────────────────────────────

export type ValidationRule =
  | { type: 'required'; message?: string }
  | { type: 'minLength'; value: number; message?: string }
  | { type: 'maxLength'; value: number; message?: string }
  | { type: 'email';     message?: string }
  | { type: 'url';       message?: string }
  | { type: 'pattern';   value: RegExp; message?: string }
  | { type: 'noScript';  message?: string }

export function validateInput(value: string, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value || !value.trim()) return rule.message ?? 'This field is required'
        break
      case 'minLength':
        if (value.length < rule.value) return rule.message ?? `Minimum ${rule.value} characters`
        break
      case 'maxLength':
        if (value.length > rule.value) return rule.message ?? `Maximum ${rule.value} characters`
        break
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return rule.message ?? 'Invalid email address'
        break
      case 'url':
        try { new URL(value) } catch { return rule.message ?? 'Invalid URL' }
        break
      case 'pattern':
        if (!rule.value.test(value)) return rule.message ?? 'Invalid format'
        break
      case 'noScript':
        if (/<script|javascript:|on\w+\s*=/i.test(value)) return rule.message ?? 'Unsafe content detected'
        break
    }
  }
  return null
}

// ── Client-side rate limiter (token bucket) ───────────────────────────────────

export class RateLimiter {
  private tokens:   number
  private maxTokens: number
  private refillRate: number  // tokens per ms
  private lastRefill: number

  constructor(maxPerMinute: number) {
    this.maxTokens  = maxPerMinute
    this.tokens     = maxPerMinute
    this.refillRate = maxPerMinute / 60000
    this.lastRefill = Date.now()
  }

  private refill() {
    const now     = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens   = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }

  /** Returns true if the action is allowed, false if rate limited */
  tryConsume(tokens = 1): boolean {
    this.refill()
    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return true
    }
    return false
  }

  /** How many ms until the next token is available */
  msUntilNext(): number {
    this.refill()
    if (this.tokens >= 1) return 0
    return Math.ceil((1 - this.tokens) / this.refillRate)
  }
}

// Shared rate limiter for AI generation calls (10/min default, matches org settings default)
export const aiGenerationLimiter = new RateLimiter(10)

// ── usePaginatedData hook ─────────────────────────────────────────────────────

export interface PaginatedData<T> {
  page:        number
  pageSize:    number
  totalPages:  number
  totalCount:  number
  items:       T[]
  hasNext:     boolean
  hasPrev:     boolean
  setPage:     (page: number) => void
  nextPage:    () => void
  prevPage:    () => void
  reset:       () => void
}

export function usePaginatedData<T>(data: T[], pageSize = 20): PaginatedData<T> {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  // Clamp page when data shrinks
  const safePage   = Math.min(page, totalPages - 1)

  const items = useMemo(
    () => data.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [data, safePage, pageSize],
  )

  const reset    = useCallback(() => setPage(0), [])
  const nextPage = useCallback(() => setPage((p) => Math.min(p + 1, totalPages - 1)), [totalPages])
  const prevPage = useCallback(() => setPage((p) => Math.max(p - 1, 0)), [])

  return {
    page: safePage, pageSize,
    totalPages, totalCount: data.length,
    items, hasNext: safePage < totalPages - 1, hasPrev: safePage > 0,
    setPage: useCallback((p) => setPage(Math.max(0, Math.min(p, totalPages - 1))), [totalPages]),
    nextPage, prevPage, reset,
  }
}

// ── useDebounceValue hook ─────────────────────────────────────────────────────

export function useDebounceValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror value changes with delay
  const valueRef = useRef(value)
  valueRef.current = value

  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => setDebounced(valueRef.current), delayMs)

  return debounced
}

// ── Error boundary helpers ────────────────────────────────────────────────────

export function formatApiError(err: unknown): string {
  if (!err) return 'An unknown error occurred'
  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))
      return 'Network error — check your connection and try again'
    if (err.message.includes('401') || err.message.includes('Unauthorized'))
      return 'Session expired — please refresh the page'
    if (err.message.includes('429') || err.message.includes('rate limit'))
      return 'Too many requests — please wait a moment and try again'
    if (err.message.includes('500') || err.message.includes('Internal Server'))
      return 'Server error — our team has been notified'
    return err.message
  }
  return String(err)
}

/** Truncate overly long AI responses to a safe display length */
export function truncateContent(text: string, maxChars = 5000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[Content truncated — copy to view full text]'
}
