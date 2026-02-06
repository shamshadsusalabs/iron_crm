import { create } from 'zustand'
import axios from 'axios'

// Keep in sync with axiosInstance baseURL
const BASE_URL = 'http://localhost:5000/api/admin'

interface AuthState {
  accessToken: string | null
  adminId: string | null
  isAuthenticated: boolean
  setAuth: (token: string, adminId: string) => void
  logout: () => void
  refreshToken: () => Promise<string | null>
}

const useAuthStore = create<AuthState>((set) => ({
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  adminId: typeof window !== 'undefined' ? localStorage.getItem('adminId') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,

  setAuth: (token, adminId) => {
    localStorage.setItem('accessToken', token)
    localStorage.setItem('adminId', adminId)
    set({ accessToken: token, adminId, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('adminId')
    set({ accessToken: null, adminId: null, isAuthenticated: false })
    window.location.href = '/'
  },

  refreshToken: async () => {
    try {
      const response = await axios.post(`${BASE_URL}/refresh-token`, {}, { withCredentials: true })
      const newToken = response.data?.accessToken as string | undefined
      if (newToken) {
        localStorage.setItem('accessToken', newToken)
        set({ accessToken: newToken, isAuthenticated: true })
        return newToken
      }
      return null
    } catch (error) {
      // On failure, clear auth and redirect to login
      localStorage.removeItem('accessToken')
      set({ accessToken: null, isAuthenticated: false })
      window.location.href = '/'
      return null
    }
  },
}))

export default useAuthStore
