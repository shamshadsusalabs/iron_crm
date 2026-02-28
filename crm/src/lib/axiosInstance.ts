import axios from "axios"
import useAuthStore from "../store/useAuthStore"

const baseURL = `${import.meta.env.VITE_API_URL ?? "https://crmbackend-469714.el.r.appspot.com"}/api/admin`

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
})

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh logic for login endpoint to avoid infinite loops or unnecessary refreshes
    if (error.config.url?.includes('/login')) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const { refreshToken } = useAuthStore.getState()
      const newToken = await refreshToken()

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return axiosInstance(originalRequest)
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance