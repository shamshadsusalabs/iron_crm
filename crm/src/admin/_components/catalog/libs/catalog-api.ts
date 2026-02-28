import type { CatalogItem, CatalogCategory, PaginationInfo, CatalogFile } from '../types/catalog'

// Helper to get adminId from localStorage (aligns with follow-up API)
const getAdminId = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('adminId') || ''
  }
  return ''
}

const API_URL = import.meta.env.VITE_API_URL || 'https://crmbackend-469714.el.r.appspot.com'

const getMerchToken = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('merchAccessToken') || ''
  }
  return ''
}

// Try common keys for admin access token
const getAdminToken = (): string => {
  if (typeof window !== 'undefined') {
    return (
      localStorage.getItem('adminAccessToken') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('token') ||
      ''
    )
  }
  return ''
}

const isMerch = () => {
  // Determine context strictly by pathname to avoid stale merch token on admin UI
  const onMerchPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/merchandiser')
  return onMerchPath
}

const getPrefix = () => (isMerch() ? '/api/merch/catalog' : '/api/catalog')

// Refresh merch access token using stored refresh token
let refreshing: Promise<string | null> | null = null
async function refreshMerchToken(): Promise<string | null> {
  if (refreshing) return refreshing
  if (typeof window === 'undefined') return null
  const rt = localStorage.getItem('merchRefreshToken') || ''
  if (!rt) return null
  refreshing = fetch(`${API_URL}/api/merch/refresh-token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-refresh-token': rt },
  })
    .then(async (res) => {
      if (!res.ok) return null
      const data = await res.json().catch(() => ({}))
      const newToken: string | undefined = data?.accessToken
      if (newToken) {
        localStorage.setItem('merchAccessToken', newToken)
        return newToken
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function http<T>(suffixPath: string, options: RequestInit = {}): Promise<T> {
  const adminId = getAdminId()
  const merchToken = getMerchToken()
  const adminToken = getAdminToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(adminId ? { 'X-Admin-ID': adminId } : {}),
  }
  const useMerch = isMerch()
  const bearer = useMerch ? merchToken : adminToken
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  const doFetch = (hdrs: Record<string, string>) => fetch(`${API_URL}${getPrefix()}${suffixPath}`, {
    credentials: 'include',
    headers: { ...hdrs, ...(options.headers || {}) },
    ...options,
  })
  let res = await doFetch(headers)
  // If merch call and unauthorized, try refresh once
  const isMerchCall = getPrefix().startsWith('/api/merch')
  if (res.status === 401 && isMerchCall) {
    const newToken = await refreshMerchToken()
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
      res = await doFetch(retryHeaders)
    } else {
      // Clear stale tokens to avoid loops
      if (typeof window !== 'undefined') {
        localStorage.removeItem('merchAccessToken')
        localStorage.removeItem('merchRefreshToken')
      }
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const catalogApi = {
  // Categories
  async createCategory(payload: { name: string; description?: string }) {
    const data = await http<{ success: boolean; data: CatalogCategory }>(`/categories`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data.data
  },
  async getCategories() {
    const data = await http<{ success: boolean; data: CatalogCategory[] }>(`/categories`)
    return data.data
  },
  async updateCategory(id: string, payload: Partial<CatalogCategory>) {
    const data = await http<{ success: boolean; data: CatalogCategory }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return data.data
  },
  async deleteCategory(id: string) {
    await http<{ success: boolean; message: string }>(`/categories/${id}`, { method: 'DELETE' })
  },

  // Items
  async createItem(payload: Partial<CatalogItem>) {
    // Ensure creator fields based on role
    const adminId = getAdminId()
    const merchToken = getMerchToken()
    if (!adminId && !merchToken) {
      throw new Error('Not authenticated. Please log in.')
    }
    const enriched = {
      userId: (payload as any).userId || (adminId || 'self'),
      createdBy: (payload as any).createdBy || (adminId || 'self'),
      createdByRole: (payload as any).createdByRole || (merchToken ? 'merch' : 'admin'),
      ...payload,
    }
    const data = await http<{ success: boolean; data: CatalogItem }>(`/items`, {
      method: 'POST',
      body: JSON.stringify(enriched),
    })
    return data.data
  },
  async getItems(params: { page?: number; limit?: number; search?: string; categoryId?: string; status?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.search) qs.set('search', params.search)
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    if (params.status) qs.set('status', params.status)
    const data = await http<{ success: boolean; items: CatalogItem[]; pagination: PaginationInfo }>(
      `/items?${qs.toString()}`,
    )
    return data
  },
  async getItem(id: string) {
    const data = await http<{ success: boolean; data: CatalogItem }>(`/items/${id}`)
    return data.data
  },
  async updateItem(id: string, payload: Partial<CatalogItem>) {
    const data = await http<{ success: boolean; data: CatalogItem }>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return data.data
  },
  async deleteItem(id: string) {
    await http<{ success: boolean; message: string }>(`/items/${id}`, { method: 'DELETE' })
  },

  // Admin: approve pending item
  async approveItem(id: string) {
    const data = await http<{ success: boolean; data: CatalogItem }>(`/items/${id}/approve`, {
      method: 'PATCH',
    })
    return data.data
  },

  async uploadImage(file: File) {
    const adminId = getAdminId()
    const merchToken = getMerchToken()
    const adminToken = getAdminToken()
    const form = new FormData()
    form.append('image', file)
    const path = isMerch() ? '/api/merch/catalog/upload/image' : '/api/catalog/upload/image'
    const headers: Record<string, string> = {}
    if (adminId) headers['X-Admin-ID'] = adminId
    const bearer = isMerch() ? merchToken : adminToken
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || `Upload failed: ${res.status}`)
    }
    const data = await res.json()
    return data.data as { publicId?: string; url: string; width?: number; height?: number; format?: string }
  },

  async uploadFile(file: File) {
    const adminId = getAdminId()
    const merchToken = getMerchToken()
    const adminToken = getAdminToken()
    const form = new FormData()
    form.append('file', file)
    const path = isMerch() ? '/api/merch/catalog/upload/file' : '/api/catalog/upload/file'
    const headers: Record<string, string> = {}
    if (adminId) headers['X-Admin-ID'] = adminId
    const bearer = isMerch() ? merchToken : adminToken
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message || `Upload failed: ${res.status}`)
    }
    const data = await res.json()
    return data.data as CatalogFile
  },
}
