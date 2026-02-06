export interface EmailHeader {
  date: string[]
  "message-id": string[]
  subject: string[]
  from: string[]
  to: string[]
  cc?: string[]
  bcc?: string[]
  references?: string[]
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  contentId?: string
  base64Data?: string
}

export interface Email {
  headers: EmailHeader
  body: string
  htmlContent?: string
  attachments: EmailAttachment[]
  seqno: number
  uid: number
  threadId: string
  _debugThreadId?: string
}

export interface EmailThread {
  threadId: string
  emails: Email[]
}

export interface ApiResponse {
  success: boolean
  data: EmailThread[]
  message?: string
  totalThreads?: number
}
