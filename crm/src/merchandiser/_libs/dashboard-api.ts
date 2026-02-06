import merchAxios from '@/lib/merchAxios'

export type SummaryDto = {
  leads: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
  events: { total: number; upcoming: number }
  catalogs: { total: number }
  templates: { total: number }
}

export type TimeseriesDto = {
  leadsMonthly: { _id: { y: number; m: number }; count: number }[]
  eventsMonthly: { _id: { y: number; m: number }; count: number }[]
}

export const merchDashboardApi = {
  async summary(): Promise<SummaryDto> {
    const { data } = await merchAxios.get('/dashboard/summary')
    return data as SummaryDto
  },
  async timeseries(): Promise<TimeseriesDto> {
    const { data } = await merchAxios.get('/dashboard/timeseries')
    return data as TimeseriesDto
  },
}
