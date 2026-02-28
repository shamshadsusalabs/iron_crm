import type {
  FollowUp,
  FollowUpSequence,
  FollowUpStats,
  FollowUpResponse,
  FollowUpPagination,
  SchedulerStatus
} from '../../follow-up/types/follow-up'

const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'https://crmbackend-469714.el.r.appspot.com'}/api/follow-ups`

const getAdminId = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('adminId') || ''
  }
  return ''
}

class FollowUpApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const adminId = getAdminId()
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(adminId ? { 'X-Admin-ID': adminId } : {}),
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Get all follow-ups with filters
  async getAllFollowUps(params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    priority?: string
    category?: string
  } = {}): Promise<{ followUps: FollowUp[], pagination: FollowUpPagination }> {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })

    const response = await this.request<FollowUpResponse>(`/all?${searchParams.toString()}`)
    return response.data as unknown as { followUps: FollowUp[], pagination: FollowUpPagination }
  }

  // Get follow-up by ID
  async getFollowUpById(id: string): Promise<FollowUp> {
    const response = await this.request<FollowUpResponse>(`/${id}`)
    return response.data as FollowUp
  }

  // Create new follow-up
  async createFollowUp(followUpData: Partial<FollowUp>): Promise<FollowUp> {
    const response = await this.request<FollowUpResponse>('/create', {
      method: 'POST',
      body: JSON.stringify(followUpData),
    })
    return response.data as FollowUp
  }

  // Update follow-up
  async updateFollowUp(id: string, updateData: Partial<FollowUp>): Promise<FollowUp> {
    const response = await this.request<FollowUpResponse>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    return response.data as FollowUp
  }

  // Delete follow-up
  async deleteFollowUp(id: string): Promise<{ message: string }> {
    const response = await this.request<FollowUpResponse>(`/${id}`, {
      method: 'DELETE',
    })
    return response.data as unknown as { message: string }
  }

  // Send follow-up email manually
  async sendFollowUpEmail(id: string): Promise<{ success: boolean, messageId: string, followUp: FollowUp }> {
    const response = await this.request<FollowUpResponse>(`/${id}/send`, {
      method: 'POST',
    })
    return response.data as unknown as { success: boolean, messageId: string, followUp: FollowUp }
  }

  // Create follow-up sequence
  async createFollowUpSequence(sequenceData: FollowUpSequence): Promise<FollowUp[]> {
    const response = await this.request<FollowUpResponse>('/sequence/create', {
      method: 'POST',
      body: JSON.stringify(sequenceData),
    })
    return response.data as FollowUp[]
  }

  // Get follow-up statistics
  async getFollowUpStats(): Promise<FollowUpStats> {
    const response = await this.request<FollowUpResponse>('/stats/overview')
    return response.data as FollowUpStats
  }

  // Get follow-ups by user
  async getFollowUpsByUser(userId: string, params: {
    page?: number
    limit?: number
    status?: string
  } = {}): Promise<{ followUps: FollowUp[], pagination: FollowUpPagination }> {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })

    const response = await this.request<FollowUpResponse>(`/user/${userId}?${searchParams.toString()}`)
    return response.data as unknown as { followUps: FollowUp[], pagination: FollowUpPagination }
  }

  // Cancel follow-up
  async cancelFollowUp(id: string): Promise<FollowUp> {
    const response = await this.request<FollowUpResponse>(`/${id}/cancel`, {
      method: 'POST',
    })
    return response.data as FollowUp
  }

  // Reschedule follow-up
  async rescheduleFollowUp(id: string, scheduledDate: string): Promise<FollowUp> {
    const response = await this.request<FollowUpResponse>(`/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ scheduledDate }),
    })
    return response.data as FollowUp
  }

  // Get pending follow-ups
  async getPendingFollowUps(): Promise<FollowUp[]> {
    const response = await this.request<FollowUpResponse>('/pending/list')
    return response.data as FollowUp[]
  }

  // Get overdue follow-ups
  async getOverdueFollowUps(): Promise<FollowUp[]> {
    const response = await this.request<FollowUpResponse>('/overdue/list')
    return response.data as FollowUp[]
  }

  // Mark follow-up as replied
  async markFollowUpAsReplied(recipientEmail: string, subject: string): Promise<FollowUp | null> {
    const response = await this.request<FollowUpResponse>('/mark-replied', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail, subject }),
    })
    return response.data as FollowUp | null
  }

  // Scheduler control
  async startScheduler(): Promise<{ success: boolean, message: string }> {
    const response = await this.request<FollowUpResponse>('/scheduler/start', {
      method: 'POST',
    })
    return response.data as unknown as { success: boolean, message: string }
  }

  async stopScheduler(): Promise<{ success: boolean, message: string }> {
    const response = await this.request<FollowUpResponse>('/scheduler/stop', {
      method: 'POST',
    })
    return response.data as unknown as { success: boolean, message: string }
  }

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    const response = await this.request<FollowUpResponse>('/scheduler/status')
    return response.data as unknown as SchedulerStatus
  }

  async manualCheck(): Promise<{ success: boolean, message: string }> {
    const response = await this.request<FollowUpResponse>('/scheduler/check', {
      method: 'POST',
    })
    return response.data as unknown as { success: boolean, message: string }
  }
}

export const followUpApi = new FollowUpApiService() 