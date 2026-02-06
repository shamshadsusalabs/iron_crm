import merchAxios from '@/lib/merchAxios'

export interface EventPayload {
  name: string
  type: 'one-time' | 'recurring'
  startAt: string // ISO
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval?: number | null
  endDate?: string | null
  audience?: string[]
  template?: string
  attachments?: { file: string }[]
}

export interface EventDto extends EventPayload {
  _id: string
  createdAt: string
  updatedAt: string
}

export const eventApi = {
  async create(payload: EventPayload) {
    const { data } = await merchAxios.post('/events', payload)
    return data.data as EventDto
  },
  async list(params: { page?: number; limit?: number } = {}) {
    const { data } = await merchAxios.get('/events', { params })
    return { events: data.data as EventDto[], pagination: data.pagination as { page: number; limit: number; total: number; pages: number } }
  },
  async update(id: string, payload: Partial<EventPayload>) {
    const { data } = await merchAxios.put(`/events/${id}`, payload)
    return data.data as EventDto
  },
  async remove(id: string) {
    await merchAxios.delete(`/events/${id}`)
  },
  async upload(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await merchAxios.post('/events/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.url as string
  },
}
