export type EnquiryPriority = 'High' | 'Medium' | 'Low'
export type EnquiryStatus = 'New' | 'In Progress' | 'Responded' | 'Closed'

export interface CustomerEnquiry {
  _id: string
  name: string
  email?: string
  phone?: string
  products: string[]
  priority: EnquiryPriority
  status: EnquiryStatus
  notes?: string
  source?: string
  assignedTo?: string
  createdBy?: { _id: string; name?: string; email?: string } | string
  createdByModel?: 'User' | 'Admin'
  createdAt?: string
  updatedAt?: string
}

export interface EnquiryListResponse {
  items: CustomerEnquiry[]
  total: number
  page: number
  limit: number
}
