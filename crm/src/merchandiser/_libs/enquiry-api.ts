import merchAxios from '@/lib/merchAxios'

export interface EnquiryPayload {
  name: string
  email?: string
  phone?: string
  products?: string[]
  status?: string
  priority?: string
  notes?: string
}

export interface EnquiryDto extends EnquiryPayload {
  _id: string
  createdAt: string
  updatedAt: string
}

export interface EnquiryListResponse {
  items: EnquiryDto[]
  total: number
  page: number
  limit: number
}

export const enquiryApi = {
  async list(params: { page?: number; limit?: number; search?: string; status?: string; priority?: string } = {}) {
    const { data } = await merchAxios.get<EnquiryListResponse>('/enquiries', { params })
    return data
  },
  async create(payload: EnquiryPayload) {
    const { data } = await merchAxios.post<EnquiryDto>('/enquiries', payload)
    return data
  },
  async update(id: string, payload: Partial<EnquiryPayload>) {
    const { data } = await merchAxios.put<EnquiryDto>(`/enquiries/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await merchAxios.delete(`/enquiries/${id}`)
  },
}
