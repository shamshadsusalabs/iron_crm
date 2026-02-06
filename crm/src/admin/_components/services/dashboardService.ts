import axiosInstance from '@/lib/axiosInstance'

export type DashboardSummary = {
  customers: { total: number; last30d: number }
  enquiries: { total: number; today: number; thisWeek: number; byStatus: Record<string, number>; conversionRate: number; overdueOpen: number }
  emails: { sent7d: number; openRate7d: number; clickRate7d: number }
}

export type DashboardTimeseries = {
  customersMonthly: Array<{ _id: { y: number; m: number }; count: number }>
  enquiriesWeekly: Array<{ _id: { y: number; w: number }; count: number }>
  enquiriesByStatus: Array<{ _id: string; count: number }>
  enquiriesByPriority: Array<{ _id: string; count: number }>
  topProducts: Array<{ _id: string; count: number }>
  topSources: Array<{ _id: string; count: number }>
  followupsMonthly: {
    scheduled: Array<{ _id: { y: number; m: number }; count: number }>
    sent: Array<{ _id: { y: number; m: number }; count: number }>
  }
  catalogMonthly: Array<{ _id: { y: number; m: number }; count: number }>
  ageingBuckets: Array<{ _id: number | string; count: number }>
  conversionBySource: Array<{ _id: string; total: number; converted: number }>
  conversionByProduct: Array<{ _id: string; total: number; converted: number }>
  teamPerformance: Array<{ _id: string; total: number; closed: number }>
}

export type DashboardRecent = {
  enquiries: Array<{ _id: string; name?: string; email?: string; phone?: string; status?: string; priority?: string; source?: string; products?: string[]; createdAt: string }>
  customers: Array<{ _id: string; name: string; email: string; status?: string; createdAt: string }>
}

export const dashboardService = {
  async summary() {
    const res = await axiosInstance.get<DashboardSummary>('/dashboard/summary')
    return res.data
  },
  async timeseries(params?: { start?: string; end?: string }) {
    const res = await axiosInstance.get<DashboardTimeseries>('/dashboard/timeseries', { params })
    return res.data
  },
  async recent(params?: { limit?: number }) {
    const res = await axiosInstance.get<DashboardRecent>('/dashboard/recent', { params })
    return res.data
  },
}
