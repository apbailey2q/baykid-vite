/**
 * useOperationsSettings — React Query wrapper for operations_settings.
 *
 * Defaults to city_code='default'. Returns DEFAULT_OPERATIONS_SETTINGS while
 * loading so consumers never need to handle undefined.
 * 5-minute staleTime per CLAUDE.md performance rules (non-critical query).
 */

import { useQuery } from '@tanstack/react-query'
import { getOperationsSettings } from '../lib/operationsSettings'
import { DEFAULT_OPERATIONS_SETTINGS } from '../types/operationsSettings'
import type { OperationsSettings } from '../types/operationsSettings'

export function useOperationsSettings(cityCode = 'default'): {
  settings: OperationsSettings
  isLoading: boolean
} {
  const { data, isLoading } = useQuery<OperationsSettings>({
    queryKey:  ['operations-settings', cityCode],
    queryFn:   () => getOperationsSettings(cityCode),
    staleTime: 5 * 60 * 1_000, // 5 minutes
  })

  return {
    settings:  data ?? DEFAULT_OPERATIONS_SETTINGS,
    isLoading,
  }
}
