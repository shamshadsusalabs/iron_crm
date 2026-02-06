import { create } from 'zustand'
import { enquiryService } from '@/admin/_components/services/enquiryService'
import type { CustomerEnquiry, EnquiryPriority, EnquiryStatus } from '@/admin/_components/types/enquiry'

interface EnquiryState {
  items: CustomerEnquiry[]
  total: number
  page: number
  limit: number
  loading: boolean
  search: string
  status?: EnquiryStatus
  priority?: EnquiryPriority

  setSearch: (q: string) => void
  setPage: (p: number) => void
  setLimit: (l: number) => void
  setStatus: (s?: EnquiryStatus) => void
  setPriority: (p?: EnquiryPriority) => void

  fetch: () => Promise<void>
  update: (id: string, input: Partial<CustomerEnquiry>) => Promise<CustomerEnquiry | null>
  create: (input: Partial<CustomerEnquiry>) => Promise<CustomerEnquiry | null>
  remove: (id: string) => Promise<boolean>
}

export const useEnquiryStore = create<EnquiryState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  loading: false,
  search: '',
  status: undefined,
  priority: undefined,

  setSearch: (q) => set({ search: q, page: 1 }),
  setPage: (p) => set({ page: p }),
  setLimit: (l) => set({ limit: l, page: 1 }),
  setStatus: (s) => set({ status: s, page: 1 }),
  setPriority: (p) => set({ priority: p, page: 1 }),

  fetch: async () => {
    const { page, limit, search, status, priority } = get()
    set({ loading: true })
    try {
      const res = await enquiryService.list({ page, limit, search: search || undefined, status, priority })
      set({ items: res.items, total: res.total, page: res.page, limit: res.limit })
    } finally {
      set({ loading: false })
    }
  },

  create: async (input) => {
    try {
      const created = await enquiryService.create(input)
      set((s) => ({ items: [created, ...s.items], total: s.total + 1 }))
      return created
    } catch {
      return null
    }
  },

  update: async (id, input) => {
    try {
      const updated = await enquiryService.update(id, input)
      set((s) => ({ items: s.items.map((e) => (e._id === updated._id ? updated : e)) }))
      return updated
    } catch {
      return null
    }
  },

  remove: async (id) => {
    try {
      await enquiryService.remove(id)
      set((s) => ({ items: s.items.filter((e) => e._id !== id), total: Math.max(0, s.total - 1) }))
      return true
    } catch (e: any) {
      // Surface error details in console for debugging
      console.error('[EnquiryStore] remove failed', {
        id,
        error: e,
        responseStatus: e?.response?.status,
        responseData: e?.response?.data,
      })
      return false
    }
  },
}))
