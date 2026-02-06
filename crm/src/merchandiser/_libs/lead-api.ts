import merchAxios from '@/lib/merchAxios'

export interface LeadPayload {
  customer: string
  email?: string
  status: 'Hot' | 'Cold' | 'Follow-up'
  priority: 'High' | 'Medium' | 'Low'
  lastContact?: string | null
  nextAction?: string | null
  notes?: string
  interestedProducts?: string[]
}

export interface LeadDto extends LeadPayload {
  _id: string
  createdAt: string
  updatedAt: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export const leadApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string; priority?: string; startDate?: string; endDate?: string } = {}) {
    const { data } = await merchAxios.get('/leads', { params })
    return { leads: data.data as LeadDto[], pagination: data.pagination as PaginationInfo }
  },
  async create(payload: LeadPayload) {
    const { data } = await merchAxios.post('/leads', payload)
    return data.data as LeadDto
  },
  async update(id: string, payload: Partial<LeadPayload>) {
    const { data } = await merchAxios.put(`/leads/${id}`, payload)
    return data.data as LeadDto
  },
  async remove(id: string) {
    await merchAxios.delete(`/leads/${id}`)
  },
}
