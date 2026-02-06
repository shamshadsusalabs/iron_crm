"use client"

import { useState, createContext, useContext } from "react"
import GmailEmailList from "./gmail-email-list"
import GmailEmailDetail from "./gmail-email-detail"
import ComposeEmail from "./compose-email"
import { extractEmailAddress, extractDisplayName } from "./libs/email-utils"
import type { Email, EmailThread } from "./types/email"
import { useEmails } from "./hooks/use-emails"
import { getEmailHtmlContent, formatEmailTime } from "./libs/email-utils"

// Define the context type properly
type EmailContextType = ReturnType<typeof useEmails>

// Create context with proper typing
const EmailContext = createContext<EmailContextType | undefined>(undefined)

export const useEmailContext = (): EmailContextType => {
  const context = useContext(EmailContext)
  if (!context) {
    throw new Error("useEmailContext must be used within EmailProvider")
  }
  return context
}

// Email Provider Component
export function EmailProvider({ children }: { children: React.ReactNode }) {
  const emailState = useEmails()
  
  return (
    <EmailContext.Provider value={emailState}>
      {children}
    </EmailContext.Provider>
  )
}

export default function GmailLayout() {
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [replyTo, setReplyTo] = useState<
    | {
        to: string
        subject: string
        messageId: string
        references?: string
        originalText?: string
      }
    | undefined
  >()

  const handleCompose = () => {
    setReplyTo(undefined)
    setIsComposeOpen(true)
  }

  const handleEmailClick = (thread: EmailThread) => {
    setSelectedThread(thread)
  }

  const handleBackToList = () => {
    setSelectedThread(null)
  }

  const handleReply = (email: Email) => {
    const senderEmail = extractEmailAddress(email.headers.from[0])
    const senderName = extractDisplayName(email.headers.from[0])
    const subject = email.headers.subject[0]
    const messageId = email.headers["message-id"][0]
    const references = email.headers.references?.[0]
    const originalDate = formatEmailTime(email.headers.date[0])

    // Get the original email content
    const originalContent = getEmailHtmlContent(email)

    // Create reply text with quoted original email
    const replyText = `\n\n\nOn ${originalDate}, ${senderName} <${senderEmail}> wrote:\n> ${originalContent.replace(/\n/g, "\n> ")}`

    setReplyTo({
      to: senderEmail,
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      messageId,
      references,
      originalText: replyText,
    })
    setIsComposeOpen(true)
  }

  const handleCloseCompose = () => {
    setIsComposeOpen(false)
    setReplyTo(undefined)
  }

  return (
    <EmailProvider>
      <div className="space-y-6">
        {/* Email Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Email Management</h2>
            <button
              onClick={handleCompose}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Compose Email
            </button>
          </div>
          
          {/* Email Navigation */}
          <EmailNavigation />
        </div>

        {/* Email Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {selectedThread ? (
            <GmailEmailDetail thread={selectedThread} onBack={handleBackToList} onReply={handleReply} />
          ) : (
            <GmailEmailList 
              onEmailClick={handleEmailClick} 
              onReply={handleReply}
            />
          )}
        </div>
        
        <ComposeEmail isOpen={isComposeOpen} onClose={handleCloseCompose} replyTo={replyTo} />
      </div>
    </EmailProvider>
  )
}

// Email Navigation Component
function EmailNavigation() {
  const { currentMailbox, switchMailbox } = useEmailContext()

  const handleMailboxChange = async (mailbox: 'received' | 'sent' | 'all' | 'spam') => {
    await switchMailbox(mailbox)
  }

  return (
    <div className="flex space-x-1 border-b border-gray-200">
      <button
        onClick={() => handleMailboxChange('received')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          currentMailbox === 'received'
            ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        Inbox
      </button>
      <button
        onClick={() => handleMailboxChange('sent')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          currentMailbox === 'sent'
            ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        Sent
      </button>
      <button
        onClick={() => handleMailboxChange('all')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          currentMailbox === 'all'
            ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        All Mail
      </button>
      <button
        onClick={() => handleMailboxChange('spam')}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
          currentMailbox === 'spam'
            ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        Spam
      </button>
    </div>
  )
}
