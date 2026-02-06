import { create } from 'zustand'
import { reportingService, type ReportingSummary } from '@/admin/_components/services/reportingService'

interface Range { start?: string; end?: string }

interface ReportingState {
  summary: ReportingSummary | null
  loading: boolean
  error: string | null
  range: Range

  setRange: (range: Range) => void
  fetch: () => Promise<void>
}

export const useReportingStore = create<ReportingState>((set, get) => ({
  summary: null,
  loading: false,
  error: null,
  range: {},

  setRange: (range) => set({ range }),

  fetch: async () => {
    const { range } = get()
    set({ loading: true, error: null })
    try {
      const summary = await reportingService.summary({ start: range.start, end: range.end })
      set({ summary })
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load report' })
    } finally {
      set({ loading: false })
    }
  },
}))
