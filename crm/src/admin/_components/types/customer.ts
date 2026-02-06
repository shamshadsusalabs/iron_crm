export type CustomerStatus = 'Hot' | 'Warm' | 'Cold'

export interface CustomerHistoryItem {
  date?: string | Date
  action?: string
  details?: string
}

export interface Customer {
  _id: string
  name: string
  email: string
  phone?: string
  address?: string
  status: CustomerStatus
  interestedProducts: string[]
  history: CustomerHistoryItem[]
  notes?: string
  createdBy?: { _id: string; name?: string; email?: string } | string
  createdByModel?: 'User' | 'Admin'
  createdAt?: string
  updatedAt?: string
}

export interface CustomerListResponse {
  items: Customer[]
  total: number
  page: number
  limit: number
}

export interface CreateCustomerInput {
  name: string
  email: string
  phone?: string
  address?: string
  status?: CustomerStatus
  interestedProducts?: string[]
  history?: CustomerHistoryItem[]
  notes?: string
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  id: string
}
