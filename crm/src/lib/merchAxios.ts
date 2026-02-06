import axios from 'axios'
import useMerchAuthStore from '@/store/useMerchAuthStore'

const merchAxios = axios.create({
  baseURL: 'http://localhost:5000/api/merch',
  withCredentials: true,
})

merchAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('merchAccessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Single-flight refresh management
let refreshPromise: Promise<string | null> | null = null
const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise
  const rt = localStorage.getItem('merchRefreshToken') || ''
  if (!rt) return null
  refreshPromise = merchAxios
    .post('/refresh-token', null, { headers: { 'x-refresh-token': rt } })
    .then(({ data }) => {
      const newToken = data?.accessToken as string | undefined
      if (newToken) {
        localStorage.setItem('merchAccessToken', newToken)
        const { setToken } = useMerchAuthStore.getState()
        setToken?.(newToken)
        return newToken
      }
      return null
    })
    .catch(() => {
      // On failure, clear tokens
      localStorage.removeItem('merchAccessToken')
      localStorage.removeItem('merchRefreshToken')
      return null
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

merchAxios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    const url: string = originalRequest?.url || ''
    const isAuthEndpoint = url.includes('/login') || url.includes('/refresh-token')
    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true
      const newToken = await refreshAccessToken()
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return merchAxios(originalRequest)
      }
    }
    return Promise.reject(error)
  }
)

export default merchAxios