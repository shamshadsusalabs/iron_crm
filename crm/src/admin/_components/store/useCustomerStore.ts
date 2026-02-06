import { create } from 'zustand'
import { customerService } from '@/admin/_components/services/customerService'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/admin/_components/types/customer'

interface CustomerState {
  items: Customer[]
  total: number
  page: number
  limit: number
  loading: boolean
  query: string
  status: string | null

  setQuery: (q: string) => void
  setStatus: (s: string | null) => void
  setPage: (p: number) => void
  setLimit: (l: number) => void

  fetch: () => Promise<void>
  create: (input: CreateCustomerInput) => Promise<Customer | null>
  update: (input: UpdateCustomerInput) => Promise<Customer | null>
  remove: (id: string) => Promise<boolean>
  uploadExcel: (file: File) => Promise<boolean>
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  limit: 200, // Updated default limit to 200 as requested
  loading: false,
  query: '',
  status: null,

  setQuery: (q) => set({ query: q, page: 1 }),
  setStatus: (s) => set({ status: s, page: 1 }),
  setPage: (p) => set({ page: p }),
  setLimit: (l) => set({ limit: l, page: 1 }),

  fetch: async () => {
    const { query, status, page, limit } = get()
    set({ loading: true })
    try {
      const res = await customerService.list({ q: query || undefined, status: status || undefined, page, limit })
      set({ items: res.items, total: res.total, page: res.page, limit: res.limit })
    } finally {
      set({ loading: false })
    }
  },

  create: async (input) => {
    try {
      const created = await customerService.create(input)
      set((s) => ({ items: [created, ...s.items], total: s.total + 1 }))
      return created
    } catch {
      return null
    }
  },

  update: async (input) => {
    try {
      const updated = await customerService.update(input)
      set((s) => ({ items: s.items.map((c) => (c._id === updated._id ? updated : c)) }))
      return updated
    } catch {
      return null
    }
  },

  remove: async (id) => {
    try {
      await customerService.remove(id)
      set((s) => ({ items: s.items.filter((c) => c._id !== id), total: Math.max(0, s.total - 1) }))
      return true
    } catch {
      return false
    }
  },

  uploadExcel: async (file) => {
    try {
      await customerService.uploadExcel(file)
      // refresh first page
      set({ page: 1 })
      await get().fetch()
      return true
    } catch {
      return false
    }
  },
}))
