// App store URL configuration.
// Set VITE_APPLE_APP_STORE_URL and VITE_GOOGLE_PLAY_URL in your .env file
// to enable live download buttons in the resident enrollment flow.
// Leave unset (or empty) to show "Coming Soon" buttons without breaking the flow.

export const APPLE_APP_STORE_URL: string | null =
  (import.meta.env.VITE_APPLE_APP_STORE_URL as string | undefined) || null

export const GOOGLE_PLAY_URL: string | null =
  (import.meta.env.VITE_GOOGLE_PLAY_URL as string | undefined) || null
