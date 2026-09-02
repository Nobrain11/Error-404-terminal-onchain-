/**
 * Referral flywheel (client phase)
 * - Read ?ref= from URL on load
 * - Persist referrer in localStorage
 * - Build share link with connected address
 * On-chain fee split comes in a later contract phase.
 */

const STORAGE_KEY = 'error404_ref'
const STORAGE_SELF = 'error404_ref_self'

export function captureRefFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const q = new URLSearchParams(window.location.search)
    const ref = (q.get('ref') || q.get('r') || '').trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(ref)) {
      localStorage.setItem(STORAGE_KEY, ref.toLowerCase())
      return ref.toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return getStoredRef()
}

export function getStoredRef(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && /^0x[a-f0-9]{40}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function setSelfRefCode(address: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_SELF, address.toLowerCase())
  } catch {
    /* ignore */
  }
}

export function getSelfRefCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_SELF)
  } catch {
    return null
  }
}

export function buildReferralLink(address: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://error404.xyz')
  return `${base}/?ref=${address.toLowerCase()}`
}

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}
