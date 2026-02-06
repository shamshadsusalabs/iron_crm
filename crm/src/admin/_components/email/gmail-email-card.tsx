"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Star, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseEmailBody, extractDisplayName, formatEmailTime } from "./libs/email-utils"
import type { EmailThread } from "./types/email"

interface GmailEmailCardProps {
  thread: EmailThread
  isRead?: boolean
  onClick: (thread: EmailThread) => void
}

export default function GmailEmailCard({ thread, isRead = true, onClick }: GmailEmailCardProps) {
  const latestEmail = thread.emails[0]
  const sender = extractDisplayName(latestEmail.headers.from[0])
  const subject = latestEmail.headers.subject[0] || "No Subject"
  const time = formatEmailTime(latestEmail.headers.date[0])
  const snippet = parseEmailBody(latestEmail).substring(0, 100) + "..."
  const starred = false
  const emailCount = thread.emails.length
  const hasAttachments = latestEmail.attachments && latestEmail.attachments.length > 0

  return (
    <div
      className={cn(
        "flex items-center p-3 border-b cursor-pointer hover:shadow-md hover:z-10 transition-shadow",
        !isRead ? "bg-white font-semibold" : "bg-gray-50 text-gray-700",
      )}
      onClick={() => onClick(thread)}
    >
      <div className="flex items-center gap-3 w-1/12 min-w-[80px]">
        <Checkbox
          id={`thread-${thread.threadId}`}
          aria-label={`Select thread from ${sender}`}
          onClick={(e) => e.stopPropagation()}
        />
        <Star className={cn("h-4 w-4", starred ? "text-yellow-500 fill-yellow-500" : "text-gray-400")} />
      </div>

      <div className="w-2/12 min-w-[120px] truncate">
        <span className={cn(!isRead ? "font-bold" : "font-normal")}>{sender}</span>
      </div>

      <div className="flex-1 flex items-center gap-2 truncate px-2">
        <span className={cn(!isRead ? "font-bold" : "font-normal")}>{subject}</span>
        <span className="text-gray-500">- {snippet}</span>
        {emailCount > 1 && <span className="text-blue-600 text-sm">({emailCount})</span>}
        {hasAttachments && <Paperclip className="h-4 w-4 text-gray-500" />}
      </div>

      <div className="w-20 text-right text-sm text-gray-500">{time}</div>
    </div>
  )
}
