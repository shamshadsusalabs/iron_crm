import axiosInstance from '@/lib/axiosInstance'
import merchAxios from '@/lib/merchAxios'
import type {
  Customer,
  CustomerListResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '@/admin/_components/types/customer'

const getClient = () => {
  // For admin components, always use axiosInstance (admin API)
  // Only use merchAxios if explicitly in merchandiser context
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const isMerchandiserRoute = currentPath.includes('/merchandiser')

  if (isMerchandiserRoute) {
    const merchToken = typeof window !== 'undefined' ? localStorage.getItem('merchAccessToken') : null
    return merchToken ? merchAxios : axiosInstance
  }

  // For admin routes, always use admin client
  return axiosInstance
}

export const customerService = {
  async list(params?: { q?: string; status?: string; page?: number; limit?: number }) {
    const client = getClient()
    const res = await client.get<CustomerListResponse>('/customers', {
      params,
    })
    return res.data
  },

  async get(id: string) {
    const client = getClient()
    const res = await client.get<Customer>(`/customers/${id}`)
    return res.data
  },

  async create(input: CreateCustomerInput) {
    const client = getClient()
    const res = await client.post<Customer>('/customers', input)
    return res.data
  },

  async update(input: UpdateCustomerInput) {
    const { id, ...payload } = input
    const client = getClient()
    const res = await client.put<Customer>(`/customers/${id}`, payload)
    return res.data
  },

  async remove(id: string) {
    const client = getClient()
    const res = await client.delete<{ message: string }>(`/customers/${id}`)
    return res.data
  },

  async uploadExcel(file: File) {
    console.log('=== FRONTEND: Starting Excel upload ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const client = getClient()
    console.log('Using client baseURL:', client.defaults.baseURL);

    const fd = new FormData()
    fd.append('file', file)

    console.log('Making POST request to /customers/upload-excel');
    const res = await client.post<{ message: string; result: any }>(
      '/customers/upload-excel',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )

    console.log('Upload response:', res.data);
    return res.data
  },
}
