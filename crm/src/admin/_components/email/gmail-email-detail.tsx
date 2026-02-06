"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Reply, ReplyAll, MoreVertical, Star, Archive, Delete, Download, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getEmailHtmlContent,
  extractDisplayName,
  extractEmailAddress,
  formatEmailTime,
  formatFileSize,
} from "./libs/email-utils"
import type { Email, EmailThread } from "./types/email"

interface GmailEmailDetailProps {
  thread: EmailThread
  onBack: () => void
  onReply: (email: Email) => void
}

export default function GmailEmailDetail({ thread, onBack, onReply }: GmailEmailDetailProps) {
  const latestEmail = thread.emails[0]
  const subject = latestEmail.headers.subject[0] || "No Subject"

  const handleAttachmentDownload = (attachment: any) => {
    if (attachment.base64Data) {
      const byteCharacters = atob(attachment.base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: attachment.contentType })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = attachment.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-medium truncate max-w-md">{subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Delete className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Email Thread */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {thread.emails.map((email, index) => {
            const sender = extractDisplayName(email.headers.from[0])
            const senderEmail = extractEmailAddress(email.headers.from[0])
            const time = formatEmailTime(email.headers.date[0])
            const htmlContent = getEmailHtmlContent(email)
            const isLatest = index === 0
            const hasAttachments = email.attachments && email.attachments.length > 0

            return (
              <div
                key={email.uid}
                className={cn("border rounded-lg bg-white shadow-sm", isLatest ? "border-gray-300" : "border-gray-200")}
              >
                {/* Email Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://ui-avatars.com/api/?name=${sender}&background=random`} />
                      <AvatarFallback>{sender.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{sender}</div>
                      <div className="text-sm text-gray-500">to me • {time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onReply(email)}>
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-4">
                  <div className="prose max-w-none">
                    {email.htmlContent ? (
                      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{htmlContent}</pre>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                {hasAttachments && (
                  <div className="px-4 pb-4">
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {email.attachments.length} attachment{email.attachments.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {email.attachments.map((attachment, attachIndex) => (
                          <div
                            key={attachIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {attachment.contentType.startsWith("image/") ? (
                                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                    <span className="text-blue-600 text-xs font-medium">IMG</span>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                    <Paperclip className="h-4 w-4 text-gray-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{attachment.filename}</p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachment.size)} • {attachment.contentType}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAttachmentDownload(attachment)}
                              className="flex-shrink-0"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Reply Actions */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2">
          <Button onClick={() => onReply(latestEmail)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          <Button variant="outline">
            <ReplyAll className="h-4 w-4 mr-2" />
            Reply all
          </Button>
        </div>
      </div>
    </div>
  )
}
