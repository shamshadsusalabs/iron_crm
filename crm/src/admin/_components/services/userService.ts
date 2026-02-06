import axiosInstance from '@/lib/axiosInstance'
import type { CreateUserInput, UpdateUserInput, User, UserListResponse } from '@/admin/_components/types/user'

function buildFormData(data: { [k: string]: any }) {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (typeof v === 'boolean') fd.append(k, String(v))
    else fd.append(k, v as any)
  })
  return fd
}

export const userService = {
  async list(query?: string) {
    const res = await axiosInstance.get<UserListResponse | User[]>('/users/list', {
      params: query ? { q: query } : undefined,
    })
    // Support both shapes
    if (Array.isArray(res.data)) {
      return { items: res.data, total: res.data.length, page: 1, limit: res.data.length }
    }
    return res.data
  },

  async create(input: CreateUserInput) {
    const { name, email, active = true, avatarFile, password } = input
    const fd = buildFormData({ name, email, active, password, avatar: avatarFile || undefined })
    const res = await axiosInstance.post<User>('/users/create', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async update(input: UpdateUserInput) {
    const { id, name, active, avatarFile, password } = input
    const fd = buildFormData({ name, active, password, avatar: avatarFile || undefined })
    const res = await axiosInstance.put<User>(`/users/update/${id}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async remove(id: string) {
    const res = await axiosInstance.delete<{ message: string }>(`/users/delete/${id}`)
    return res.data
  },

  async toggleActive(id: string) {
    const res = await axiosInstance.patch<User>(`/users/toggle-active/${id}`)
    return res.data
  },

  // New granular permissions
  async grantLeadAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/grant-lead/${id}`)
    return res.data
  },
  async revokeLeadAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/revoke-lead/${id}`)
    return res.data
  },
  async grantCustomerProfiling(id: string) {
    const res = await axiosInstance.patch<User>(`/users/grant-customer-profiling/${id}`)
    return res.data
  },
  async revokeCustomerProfiling(id: string) {
    const res = await axiosInstance.patch<User>(`/users/revoke-customer-profiling/${id}`)
    return res.data
  },
  async grantCustomerEnquiry(id: string) {
    const res = await axiosInstance.patch<User>(`/users/grant-customer-enquiry/${id}`)
    return res.data
  },
  async revokeCustomerEnquiry(id: string) {
    const res = await axiosInstance.patch<User>(`/users/revoke-customer-enquiry/${id}`)
    return res.data
  },
  async grantEmailAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/grant-email/${id}`)
    return res.data
  },
  async revokeEmailAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/revoke-email/${id}`)
    return res.data
  },
  async grantFollowUpAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/grant-followup/${id}`)
    return res.data
  },
  async revokeFollowUpAccess(id: string) {
    const res = await axiosInstance.patch<User>(`/users/revoke-followup/${id}`)
    return res.data
  },
}
