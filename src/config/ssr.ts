/**
 * SSR configuration for TanStack Router
 *
 * This module configures the server-side rendering stream behavior to prevent
 * timeout errors during complex operations or network delays.
 */

export const SSR_CONFIG = {
  // Maximum lifetime for the SSR transform stream (default: 120s)
  // Increased to 5 minutes to handle slower local development with D1
  STREAM_LIFETIME_MS: 300000,

  // Timeout for individual loader operations
  LOADER_TIMEOUT_MS: 30000,

  // Whether to enable SSR (can be disabled for debugging)
  ENABLED: process.env.NODE_ENV !== 'test',
} as const;