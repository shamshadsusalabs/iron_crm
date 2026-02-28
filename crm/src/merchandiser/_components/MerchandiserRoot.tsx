import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { notification } from 'antd'
import AuthCard from '../AuthCard'
import useMerchAuthStore from '@/store/useMerchAuthStore'
import merchAxios from '@/lib/merchAxios'

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

const MerchandiserRoot = () => {
  const isAuthenticated = useMerchAuthStore((s) => s.isAuthenticated)
  const user = useMerchAuthStore((s) => s.user)
  const logout = useMerchAuthStore((s) => s.logout)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-logout after 12 hours
  useEffect(() => {
    if (isAuthenticated) {
      // Clear any existing timer
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(async () => {
        try {
          await merchAxios.post('/logout')
        } catch (err) {
          console.error('[AutoLogout] Logout API error:', err)
        }
        notification.warning({
          message: 'Session Expired',
          description: 'Your session has expired after 12 hours. Please login again.',
          duration: 5,
        })
        logout()
      }, SESSION_DURATION_MS)

      console.log('[Session] Auto-logout timer started (12 hours)')
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isAuthenticated, logout])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <AuthCard type="login" />
      </div>
    )
  }

  if (user && !user.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Account Inactive</h2>
          <p className="text-sm text-gray-600">Your account is inactive. Please contact administrator.</p>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}

export default MerchandiserRoot

