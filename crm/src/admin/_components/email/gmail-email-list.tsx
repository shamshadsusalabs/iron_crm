"use client"

import GmailEmailCard from "./gmail-email-card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useEmailContext } from "./gmail-layout"
import type { Email, EmailThread } from "./types/email"

interface GmailEmailListProps {
  onEmailClick: (thread: EmailThread) => void
  onReply: (email: Email) => void
}

export default function GmailEmailList({ onEmailClick, onReply }: GmailEmailListProps) {
  const { threads, loading, error, page, totalThreads, currentMailbox, nextPage, prevPage, refresh } = useEmailContext()

  const getMailboxTitle = (): string => {
    switch (currentMailbox) {
      case "received":
        return "Inbox"
      case "sent":
        return "Sent"
      case "all":
        return "All Mail"
      default:
        return "Inbox"
    }
  }

  const getMailboxDescription = (): string => {
    switch (currentMailbox) {
      case "received":
        return "inbox"
      case "sent":
        return "sent mail"
      case "all":
        return "all mail"
      default:
        return "inbox"
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b bg-white">
          <h1 className="text-xl font-medium text-gray-900">{getMailboxTitle()}</h1>
        </div>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading {getMailboxDescription()}...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b bg-white">
          <h1 className="text-xl font-medium text-gray-900">{getMailboxTitle()}</h1>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <p className="text-red-500 mb-4">Error: {error}</p>
            <Button onClick={refresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const startIndex = totalThreads > 0 ? (page - 1) * 10 + 1 : 0
  const endIndex = Math.min(page * 10, totalThreads)

  return (
    <div className="flex flex-col h-full">
      {/* Mailbox Title */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-gray-900">{getMailboxTitle()}</h1>
          <span className="text-sm text-gray-500">
            {totalThreads} {totalThreads === 1 ? "email" : "emails"}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-white">
        <div className="flex items-center gap-2">
          <Checkbox id="select-all" aria-label="Select all emails" />
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh}>
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{totalThreads > 0 ? `${startIndex}-${endIndex} of ${totalThreads}` : "No emails"}</span>
          <Button variant="ghost" size="icon" aria-label="Previous page" onClick={prevPage} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            onClick={nextPage}
            disabled={endIndex >= totalThreads}
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </Button>
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No emails in {getMailboxDescription()}</p>
              <p className="text-sm">Your {getMailboxDescription()} is empty.</p>
            </div>
          </div>
        ) : (
          threads.map((thread) => (
            <GmailEmailCard
              key={thread.threadId}
              thread={thread}
              isRead={currentMailbox === "sent"} // Sent emails are always read
              onClick={onEmailClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
