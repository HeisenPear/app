/**
 * Minimal shared-password gate.
 *
 * A single password protects the whole app. On a correct password the login
 * route sets an httpOnly cookie holding an opaque secret token; the middleware
 * lets a request through only when that cookie matches the expected token.
 *
 * Both the password and the secret can be overridden via environment variables
 * (recommended in production); sensible defaults keep the app working out of the
 * box right after deployment.
 */

export const AUTH_COOKIE = 'fdp_auth'

/** The password required to sign in. */
export function getSitePassword(): string {
  return process.env.SITE_PASSWORD || 'bj.2008'
}

/**
 * The opaque value stored in the auth cookie once signed in. Knowing it is
 * equivalent to being authenticated, so it must never be exposed to the client
 * except as the httpOnly cookie itself.
 */
export function getAuthToken(): string {
  return process.env.AUTH_SECRET || 'fdp-7f1c9a2e4b6d8051-shared-session'
}

/** Cookie lifetime in seconds (30 days). */
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30
