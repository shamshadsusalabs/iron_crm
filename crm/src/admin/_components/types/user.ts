export type UserRole = 'Merchandiser'

export interface User {
  _id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  active: boolean
  lastLogin?: string
  // removed: isFollowUpPerson, isEmailAccess
  isLeadAccess?: boolean
  isCustomerProfiling?: boolean
  isCustomerEnquiry?: boolean
  isEmailAccess?: boolean
  isFollowUpAccess?: boolean
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  limit: number
}

export interface CreateUserInput {
  name: string
  email: string
  active?: boolean
  avatarFile?: File | null
  password: string
  // removed: isFollowUpPerson, isEmailAccess
  isLeadAccess?: boolean
  isCustomerProfiling?: boolean
  isCustomerEnquiry?: boolean
  isEmailAccess?: boolean
  isFollowUpAccess?: boolean
}

export interface UpdateUserInput {
  id: string
  name?: string
  active?: boolean
  avatarFile?: File | null
  password?: string
  // removed: isFollowUpPerson, isEmailAccess
  isLeadAccess?: boolean
  isCustomerProfiling?: boolean
  isCustomerEnquiry?: boolean
  isEmailAccess?: boolean
  isFollowUpAccess?: boolean
}
