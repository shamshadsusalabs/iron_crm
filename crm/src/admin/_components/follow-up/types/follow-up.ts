export interface Campaign {
  _id: string
  name: string
  description?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'completed' | 'paused'
  template: string | Template
  contacts: string[]
  contactLists: string[]
  scheduledAt?: string | Date
  startedAt?: string | Date
  completedAt?: string | Date
  sendType: 'immediate' | 'scheduled' | 'sequence'
  sequence?: {
    initialDelay: number // hours
    followupDelays: number[] // hours between followups
    maxFollowups: number
    repeatDays?: number // Global repeat setting
    conditions: {
      openEmail: boolean
      clickLink: boolean
      replyEmail: boolean
    }
    steps?: Array<{
      delayHours: number
      templateId?: string
      contentType?: 'template' | 'catalog'
      catalogItems?: string[]
      subject?: string
      message?: string
      conditions?: {
        requireOpen?: boolean
        requireClick?: boolean
        requireNoReply?: boolean
      }
    }>
  }
  stats: {
    totalSent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
  }
  // Restart functionality fields
  restartCount?: number
  lastRestartedAt?: string | Date
  runHistory?: Array<{
    runNumber: number
    startedAt?: string | Date
    completedAt?: string | Date
    stats: {
      totalSent: number
      opened: number
      clicked: number
      bounced: number
      unsubscribed: number
    }
  }>
  userId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Contact {
  _id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  interestedProducts?: string[]
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  engagementScore: number
  tags: string[]
  userId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface ContactList {
  _id: string
  name: string
  description?: string
  contacts: Contact[]
  totalContacts: number
  userId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Template {
  _id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  type: 'initial' | 'followup1' | 'followup2' | 'followup3'
  isActive: boolean
  variables: string[]
  selectedCatalogItemIds?: string[]
  catalogLayout?: 'grid2' | 'grid3' | 'list'
  showPrices?: boolean
  userId: string
  // Ownership & approval metadata
  createdBy?: string
  createdByRole?: 'admin' | 'merch'
  approvedBy?: string | null
  approvedAt?: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface FollowUp {
  _id: string
  campaignId: string
  contactId: string
  templateId: string
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced'
  sentAt?: string | Date
  openedAt?: string | Date
  clickedAt?: string | Date
  userId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Email {
  _id: string
  to: string
  subject: string
  htmlContent: string
  textContent: string
  status: 'pending' | 'sent' | 'delivered' | 'bounced'
  sentAt?: string | Date
  deliveredAt?: string | Date
  userId: string
  createdAt: string | Date
}

export interface EmailTracking {
  _id: string
  emailId: string
  event: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'
  timestamp: string | Date
  ipAddress?: string
  userAgent?: string
  userId: string
}

export type FollowUpSection = 'dashboard' | 'campaigns' | 'templates' | 'contacts' | 'contact-lists' | 'catalog-items'

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: PaginationInfo
}

export interface CreateCampaignData {
  name: string
  description?: string
  template: string
  contacts?: string[]
  contactLists?: string[]
  sendType: 'immediate' | 'scheduled' | 'sequence'
  scheduledAt?: string | Date
  sequence?: {
    initialDelay: number
    followupDelays: number[]
    maxFollowups: number
    repeatDays?: number // Global repeat setting
    conditions: {
      openEmail: boolean
      clickLink: boolean
      replyEmail: boolean
    }
    steps?: Array<{
      delayHours: number
      templateId?: string
      contentType?: 'template' | 'catalog'
      catalogItems?: string[]
      subject?: string
      message?: string
      conditions?: {
        requireOpen?: boolean
        requireClick?: boolean
        requireNoReply?: boolean
      }
    }>
  }
}

export interface CreateContactData {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  tags?: string[]
  interestedProducts?: string[]
}

export interface CreateTemplateData {
  name: string
  subject: string
  htmlContent?: string
  textContent?: string
  type: 'initial' | 'followup1' | 'followup2' | 'followup3'
  isActive?: boolean
  variables?: string[]
  selectedCatalogItemIds?: string[]
  catalogLayout?: 'grid2' | 'grid3' | 'list'
  showPrices?: boolean
}

export interface CreateContactListData {
  name: string
  description?: string
  contacts?: string[]
  totalContacts?: number
}

// Additional types used by email follow-up API
export interface FollowUpSequence {
  name: string
  steps: Array<{
    delayHours: number
    templateId: string
    message?: string
  }>
}

export interface FollowUpStats {
  total: number
  pending: number
  sent: number
  opened: number
  clicked: number
  bounced: number
  overdue?: number
}

// Reuse generic API response/pagination types for compatibility
export type FollowUpResponse = ApiResponse<any>
export type FollowUpPagination = PaginationInfo

export interface SchedulerStatus {
  running: boolean
  lastRunAt?: string
  nextRunAt?: string
}