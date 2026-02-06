import { Outlet } from 'react-router-dom'
import AuthCard from '../AuthCard'
import useMerchAuthStore from '@/store/useMerchAuthStore'

const MerchandiserRoot = () => {
  const isAuthenticated = useMerchAuthStore((s) => s.isAuthenticated)
  const user = useMerchAuthStore((s) => s.user)
  const logout = useMerchAuthStore((s) => s.logout)

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
