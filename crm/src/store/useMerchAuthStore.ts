import { create } from 'zustand'

type MerchPermissions = {
  followUp?: boolean
  email?: boolean
  catalog?: boolean
  lead?: boolean
  template?: boolean
  customerEnquiry?: boolean
  customerProfiling?: boolean
  [key: string]: boolean | undefined
}

export interface MerchUser {
  id: string
  email: string
  isActive: boolean
  permissions: MerchPermissions
}

interface MerchAuthState {
  accessToken: string | null
  user: MerchUser | null
  isAuthenticated: boolean
  setAuth: (token: string, user: MerchUser) => void
  setToken?: (token: string) => void
  hasPermission: (key: keyof MerchPermissions) => boolean
  logout: () => void
}

const useMerchAuthStore = create<MerchAuthState>((set, get) => ({
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('merchAccessToken') : null,
  user: typeof window !== 'undefined' ? (() => {
    try { const raw = localStorage.getItem('merchUser'); return raw ? JSON.parse(raw) as MerchUser : null } catch { return null }
  })() : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('merchAccessToken') : false,

  setAuth: (token, user) => {
    localStorage.setItem('merchAccessToken', token)
    localStorage.setItem('merchUser', JSON.stringify(user))
    set({ accessToken: token, user, isAuthenticated: true })
  },

  setToken: (token) => {
    localStorage.setItem('merchAccessToken', token)
    set({ accessToken: token, isAuthenticated: !!token })
  },

  hasPermission: (key) => {
    const u = get().user
    if (!u || !u.isActive) return false
    return !!u.permissions?.[key]
  },

  logout: () => {
    localStorage.removeItem('merchAccessToken')
    localStorage.removeItem('merchUser')
    set({ accessToken: null, user: null, isAuthenticated: false })
    if (typeof window !== 'undefined') {
      window.location.href = '/merchandiser'
    }
  },
}))

export default useMerchAuthStore
