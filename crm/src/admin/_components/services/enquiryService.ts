import axiosInstance from '@/lib/axiosInstance'
import merchAxios from '@/lib/merchAxios'
import type { CustomerEnquiry, EnquiryListResponse, EnquiryStatus, EnquiryPriority } from '@/admin/_components/types/enquiry'

// Choose client based on session: admin (axiosInstance) vs merch (merchAxios)
const getClient = () => {
  const merchToken = typeof window !== 'undefined' ? localStorage.getItem('merchAccessToken') : null
  return merchToken ? merchAxios : axiosInstance
}

export const enquiryService = {
  async list(params?: { search?: string; status?: EnquiryStatus; priority?: EnquiryPriority; page?: number; limit?: number }) {
    const client = getClient()
    const res = await client.get<EnquiryListResponse>('/enquiries', { params })
    return res.data
  },

  async create(input: Partial<CustomerEnquiry>) {
    const client = getClient()
    const res = await client.post<CustomerEnquiry>('/enquiries', input)
    return res.data
  },

  async update(id: string, input: Partial<CustomerEnquiry>) {
    const client = getClient()
    const res = await client.put<CustomerEnquiry>(`/enquiries/${id}`, input)
    return res.data
  },
  
  async remove(id: string) {
    const client = getClient()
    const res = await client.delete<{ message: string }>(`/enquiries/${id}`)
    return res.data
  },
  
  // Bulk upload via Excel/CSV (admin endpoint)
  async uploadExcel(file: File) {
    const client = getClient()
    const fd = new FormData()
    fd.append('file', file)
    const res = await client.post<{ message: string; inserted?: number; result?: any }>(
      '/enquiries/upload-excel',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data
  },
}
