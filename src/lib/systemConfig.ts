import { supabase } from './supabase'

export interface DriverRates {
  consumer_stop:    number
  commercial_stop:  number
}

const DEFAULT_DRIVER_RATES: DriverRates = {
  consumer_stop:   6.10,
  commercial_stop: 14.00,
}

/**
 * Fetch driver pay rates from the system_config table.
 * Falls back to hardcoded defaults if the row is missing or on error.
 */
export async function getDriverRates(): Promise<DriverRates> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'driver_rates')
    .maybeSingle()

  if (error || !data) return DEFAULT_DRIVER_RATES

  const v = data.value as Partial<DriverRates>
  return {
    consumer_stop:   v.consumer_stop   ?? DEFAULT_DRIVER_RATES.consumer_stop,
    commercial_stop: v.commercial_stop ?? DEFAULT_DRIVER_RATES.commercial_stop,
  }
}
