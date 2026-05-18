import { useState, useEffect } from 'react'

export interface NetworkStatus {
  isOnline:   boolean
  // True from the moment the connection dropped until the next online event.
  // Useful for showing "back online — syncing" messages.
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      // wasOffline stays true until the caller clears it by checking
      // It resets on next offline event
    }
    function handleOffline() {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Reset wasOffline once we've been online long enough
  // (cleared by the sync hook after processing the queue)
  return { isOnline, wasOffline }
}
