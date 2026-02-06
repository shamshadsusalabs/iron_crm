import axiosInstance from "@/lib/axiosInstance"
import useMerchAuthStore from "@/store/useMerchAuthStore"
import type {
  Campaign,
  Contact,
  ContactList,
  Template,
  FollowUp,
  CreateCampaignData,
  CreateContactData,
  CreateTemplateData,
  CreateContactListData,
  ApiResponse,
  PaginationInfo,
} from "../types/follow-up"

// Helper to produce auth headers for Admin area (prefer Admin context)
const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const adminId = localStorage.getItem("adminId") || ""
  const impersonateUserId = localStorage.getItem("impersonateUserId") || ""
  // If admin is present and admin selected a specific merchant user, send both
  if (adminId && impersonateUserId) {
    return { "x-admin-id": adminId, "x-user-id": impersonateUserId, "x-role": "merch" }
  }
  // Normal admin-only
  if (adminId) return { "x-admin-id": adminId, "x-role": "admin" }
  // Fallback to merch if admin not present
  const { user } = useMerchAuthStore.getState?.() || ({} as any)
  const userId = user?.id || ""
  return userId ? { "x-user-id": userId, "x-role": "merch" } : {}
}

// Use public follow-up base (works for both admin and merch)
const FOLLOWUP_BASE = "http://localhost:5000/api/follow-up"

// Campaign API
export const campaignApi = {
  create: async (data: CreateCampaignData): Promise<Campaign> => {
    const response = await axiosInstance.post<ApiResponse<Campaign>>(`${FOLLOWUP_BASE}/campaigns`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getAll: async (
    page = 1,
    limit = 10,
    search = "",
    status = "",
  ): Promise<{ campaigns: Campaign[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<Campaign[]>>(`${FOLLOWUP_BASE}/campaigns`, {
      params: { page, limit, search, status },
      headers: { ...getAuthHeaders() },
    })
    return {
      campaigns: response.data.data,
      pagination: response.data.pagination!,
    }
  },

  getById: async (id: string): Promise<Campaign> => {
    const response = await axiosInstance.get<ApiResponse<Campaign>>(`${FOLLOWUP_BASE}/campaigns/${id}`, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  update: async (id: string, data: Partial<CreateCampaignData>): Promise<Campaign> => {
    const response = await axiosInstance.put<ApiResponse<Campaign>>(`${FOLLOWUP_BASE}/campaigns/${id}`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${FOLLOWUP_BASE}/campaigns/${id}`, {
      headers: { ...getAuthHeaders() },
    })
  },

  start: async (id: string): Promise<Campaign> => {
    const response = await axiosInstance.post<ApiResponse<Campaign>>(`${FOLLOWUP_BASE}/campaigns/${id}/start`, {}, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },
}

// Contact API
export const contactApi = {
  create: async (data: CreateContactData): Promise<Contact> => {
    const response = await axiosInstance.post<ApiResponse<Contact>>(`${FOLLOWUP_BASE}/contacts`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getAll: async (
    page = 1,
    limit = 10,
    search = "",
    status = "",
    listId = "",
  ): Promise<{ contacts: Contact[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<Contact[]>>(`${FOLLOWUP_BASE}/contacts`, {
      params: { page, limit, search, status, listId },
      headers: { ...getAuthHeaders() },
    })
    return {
      contacts: response.data.data,
      pagination: response.data.pagination!,
    }
  },

  update: async (id: string, data: Partial<CreateContactData>): Promise<Contact> => {
    const response = await axiosInstance.put<ApiResponse<Contact>>(`${FOLLOWUP_BASE}/contacts/${id}`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${FOLLOWUP_BASE}/contacts/${id}`, {
      headers: { ...getAuthHeaders() },
    })
  },

  bulkCreate: async (contacts: CreateContactData[]): Promise<Contact[]> => {
    const response = await axiosInstance.post<ApiResponse<Contact[]>>(`${FOLLOWUP_BASE}/contacts/bulk`, {
      contacts: contacts,
    }, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getStats: async (): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse<any>>(`${FOLLOWUP_BASE}/contacts/stats`, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },
}

// Contact List API
export const contactListApi = {
  create: async (data: CreateContactListData): Promise<ContactList> => {
    const response = await axiosInstance.post<ApiResponse<ContactList>>(`${FOLLOWUP_BASE}/contact-lists`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getAll: async (
    page = 1,
    limit = 10,
    search = "",
  ): Promise<{ contactLists: ContactList[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<ContactList[]>>(`${FOLLOWUP_BASE}/contact-lists`, {
      params: { page, limit, search },
      headers: { ...getAuthHeaders() },
    })
    return {
      contactLists: response.data.data,
      pagination: response.data.pagination!,
    }
  },

  update: async (id: string, data: Partial<CreateContactListData>): Promise<ContactList> => {
    const response = await axiosInstance.put<ApiResponse<ContactList>>(`${FOLLOWUP_BASE}/contact-lists/${id}`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${FOLLOWUP_BASE}/contact-lists/${id}`, {
      headers: { ...getAuthHeaders() },
    })
  },

  addContacts: async (listId: string, contactIds: string[]): Promise<void> => {
    await axiosInstance.post(
      `${FOLLOWUP_BASE}/contact-lists/${listId}/contacts`,
      {
        contactIds,
      },
      {
        headers: { ...getAuthHeaders() },
      },
    )
  },

  removeContacts: async (listId: string, contactIds: string[]): Promise<void> => {
    await axiosInstance.delete(
      `${FOLLOWUP_BASE}/contact-lists/${listId}/contacts`,
      {
        data: {
          contactIds,
        },
        headers: { ...getAuthHeaders() },
      },
    )
  },
}

// Template API
export const templateApi = {
  create: async (data: CreateTemplateData): Promise<Template> => {
    const response = await axiosInstance.post<ApiResponse<Template>>(`${FOLLOWUP_BASE}/templates`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getAll: async (
    page = 1,
    limit = 10,
    search = "",
    type = "",
    isActive?: boolean,
    approvedOnly?: boolean,
  ): Promise<{ templates: Template[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<Template[]>>(`${FOLLOWUP_BASE}/templates`, {
      params: { page, limit, search, type, isActive, approvedOnly },
      headers: { ...getAuthHeaders() },
    })
    return {
      templates: response.data.data,
      pagination: response.data.pagination!,
    }
  },

  update: async (id: string, data: Partial<CreateTemplateData>): Promise<Template> => {
    const response = await axiosInstance.put<ApiResponse<Template>>(`${FOLLOWUP_BASE}/templates/${id}`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  // Admin: list pending templates
  getPending: async (
    page = 1,
    limit = 10,
  ): Promise<{ templates: Template[]; pagination?: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<Template[]>>(`${FOLLOWUP_BASE}/templates/pending`, {
      params: { page, limit },
      headers: { ...getAuthHeaders() },
    })
    // Backend returns array without pagination; keep structure consistent
    return { templates: response.data.data, pagination: response.data.pagination }
  },

  approve: async (id: string): Promise<Template> => {
    const response = await axiosInstance.patch<ApiResponse<Template>>(
      `${FOLLOWUP_BASE}/templates/${id}/approve`,
      {},
      {
        headers: { ...getAuthHeaders() },
      },
    )
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${FOLLOWUP_BASE}/templates/${id}`, {
      headers: { ...getAuthHeaders() },
    })
  },
}

// Follow-up API
export const followUpApi = {
  create: async (data: any): Promise<FollowUp> => {
    const response = await axiosInstance.post<ApiResponse<FollowUp>>(`${FOLLOWUP_BASE}/followups`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  getAll: async (
    page = 1,
    limit = 10,
    status = "",
    campaignId = "",
  ): Promise<{ followUps: FollowUp[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<FollowUp[]>>(`${FOLLOWUP_BASE}/followups`, {
      params: { page, limit, status, campaignId },
      headers: { ...getAuthHeaders() },
    })
    return {
      followUps: response.data.data,
      pagination: response.data.pagination!,
    }
  },

  update: async (id: string, data: any): Promise<FollowUp> => {
    const response = await axiosInstance.put<ApiResponse<FollowUp>>(`${FOLLOWUP_BASE}/followups/${id}`, data, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${FOLLOWUP_BASE}/followups/${id}`, {
      headers: { ...getAuthHeaders() },
    })
  },
}

// Catalog API
export const catalogApi = {
  getAll: async (
    page = 1,
    limit = 100,
    search = "",
    categoryId = "",
    status = "active"
  ): Promise<{ items: any[]; pagination: PaginationInfo }> => {
    const response = await axiosInstance.get<ApiResponse<any[]>>(`http://localhost:5000/api/catalog/items`, {
      params: { page, limit, search, categoryId, status },
      headers: { ...getAuthHeaders() },
    })
    return {
      items: (response.data as any).items || response.data.data,
      pagination: (response.data as any).pagination!,
    }
  },

  getCategories: async (): Promise<any[]> => {
    const response = await axiosInstance.get<ApiResponse<any[]>>(`http://localhost:5000/api/catalog/categories`, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },
}

// Analytics API
export const analyticsApi = {
  getCampaignStats: async (campaignId: string): Promise<any> => {
    const response = await axiosInstance.get<ApiResponse<any>>(`${FOLLOWUP_BASE}/campaigns/${campaignId}/stats`, {
      headers: { ...getAuthHeaders() },
    })
    return response.data.data
  },
}
