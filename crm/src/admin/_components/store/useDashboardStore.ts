import { create } from 'zustand'
import { dashboardService, type DashboardSummary, type DashboardTimeseries, type DashboardRecent } from '@/admin/_components/services/dashboardService'

interface DashboardRange {
  start?: string
  end?: string
}

interface DashboardState {
  // data
  summary: DashboardSummary | null
  timeseries: DashboardTimeseries | null
  recent: DashboardRecent | null

  // ui state
  loading: boolean
  error: string | null

  // filters
  range: DashboardRange

  // actions
  setRange: (range: DashboardRange) => void
  fetchAll: () => Promise<void>
  refreshRecent: (limit?: number) => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  timeseries: null,
  recent: null,

  loading: false,
  error: null,

  range: {},

  setRange: (range) => set({ range }),

  fetchAll: async () => {
    const { range } = get()
    set({ loading: true, error: null })
    try {
      const [summary, timeseries, recent] = await Promise.all([
        dashboardService.summary(),
        dashboardService.timeseries({ start: range.start, end: range.end }),
        dashboardService.recent({ limit: 10 }),
      ])
      set({ summary, timeseries, recent })
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load dashboard' })
    } finally {
      set({ loading: false })
    }
  },

  refreshRecent: async (limit = 10) => {
    set({ loading: true, error: null })
    try {
      const recent = await dashboardService.recent({ limit })
      set({ recent })
    } catch (e: any) {
      set({ error: e?.message || 'Failed to refresh recent' })
    } finally {
      set({ loading: false })
    }
  },
}))
