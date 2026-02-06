import axiosInstance from '@/lib/axiosInstance'

export type AdminProfile = {
  _id: string
  name: string
  email: string
  role?: string
  lastLogin?: string
}

export const adminService = {
  async getProfile() {
    const res = await axiosInstance.get<AdminProfile>('/profile')
    return res.data
  },
  async updateProfile(payload: { name?: string; email?: string }) {
    const res = await axiosInstance.put<{ message: string; admin: AdminProfile }>(
      '/profile',
      payload
    )
    return res.data
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const res = await axiosInstance.patch<{ message: string }>(
      '/change-password',
      payload
    )
    return res.data
  },
  async logout() {
    const res = await axiosInstance.post<{ message: string }>('/logout')
    return res.data
  },
}
