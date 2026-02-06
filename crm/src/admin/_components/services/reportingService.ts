import axiosInstance from '@/lib/axiosInstance'

export type ReportingSummary = {
  customerDaily: Array<{ _id: { d: string }; count: number }>
  enquiriesDaily: Array<{ _id: { d: string }; count: number }>
  leadStatus: Array<{ _id: string; count: number }>
  activities: Array<{ type: string; date: string; user: string; activity: string; details: string }>
  emailOpenClickDaily: Array<{ _id: { d: string; type: 'opened' | 'clicked' }; count: number }>
  range: { start: string; end: string }
}

export const reportingService = {
  async summary(params?: { start?: string; end?: string }) {
    const res = await axiosInstance.get<ReportingSummary>('/reports/summary', { params })
    return res.data
  },
}
