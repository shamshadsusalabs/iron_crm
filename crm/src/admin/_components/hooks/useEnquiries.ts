import { useEnquiryStore } from '@/admin/_components/store/useEnquiryStore'

export const useEnquiries = () => {
  const s = useEnquiryStore()
  return {
    items: s.items,
    total: s.total,
    page: s.page,
    limit: s.limit,
    loading: s.loading,
    search: s.search,
    status: s.status,
    priority: s.priority,

    setSearch: s.setSearch,
    setPage: s.setPage,
    setLimit: s.setLimit,
    setStatus: s.setStatus,
    setPriority: s.setPriority,

    fetch: s.fetch,
    update: s.update,
    create: s.create,
    remove: s.remove,
  }
}
