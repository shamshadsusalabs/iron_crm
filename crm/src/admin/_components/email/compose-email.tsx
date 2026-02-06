"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  X,
  Send,
  Paperclip,
  Minimize2,
  Maximize2,
  Link,
  ImageIcon,
  Smile,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  List,
  MoreHorizontal,
  Clock,
  Trash2,
} from "lucide-react"
import { useEmailContext } from "./gmail-layout"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatFileSize } from "./libs/email-utils"

interface ComposeEmailProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: {
    to: string
    subject: string
    messageId: string
    references?: string
    originalText?: string
  }
  prefill?: {
    to?: string
    subject?: string
    text?: string
  }
}

export default function ComposeEmail({ isOpen, onClose, replyTo, prefill }: ComposeEmailProps) {
  const { sendEmail, replyToEmail } = useEmailContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [formData, setFormData] = useState({
    to: replyTo?.to || "",
    cc: "",
    bcc: "",
    subject: replyTo?.subject || "",
    text: replyTo?.originalText || "",
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [includeSignature, setIncludeSignature] = useState(true)

  // Hosted logo URLs for signature (Option 1)
  const signatureLogos = [
    // Trim any accidental trailing dots from provided URLs
    "https://res.cloudinary.com/dr9o0toid/image/upload/v1756110349/WhatsApp_Image_2025-08-25_at_1.03.33_PM_h6nn1w.jpg",
    "https://res.cloudinary.com/dr9o0toid/image/upload/v1756110662/WhatsApp_Image_2025-08-25_at_1.03.35_PM_hzun16.jpg",
    "https://res.cloudinary.com/dr9o0toid/image/upload/v1756110602/WhatsApp_Image_2025-08-25_at_1.03.35_PM_1_m4xwlu.jpg",
  ]

  // Convert plain text to HTML and append signature with 3 logos
  const buildHtmlBody = () => {
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")

    const textHtml = `<p style=\"white-space:pre-wrap; margin:0;\">${escapeHtml(formData.text)}</p>`

    if (!includeSignature) return textHtml

    const logosRow = `
      <div style=\"margin-top:30px; display:flex; gap:20px; align-items:center; justify-content:flex-start;\">
        ${signatureLogos
        .map(
          (url, i) =>
            `<a href=\"${url}\" target=\"_blank\" rel=\"noopener\" style=\"display:inline-block; margin:5px;\">` +
            `<img src=\"${url}\" alt=\"Refratex Logo ${i + 1}\" style=\"height:100px; border:0; display:block;\" loading=\"lazy\"/>` +
            `</a>`,
        )
        .join("")}
      </div>`

    const signatureBlock = `
      <div style=\"font-family:Arial,Helvetica,sans-serif; color:#111; line-height:1.5; margin-top:40px; padding-top:20px; border-top:1px solid #eee;\">
        ${logosRow}
      </div>`

    // For replies, place signature above quoted/original text
    if (replyTo) {
      return `${signatureBlock}${textHtml}`
    }
    // For new messages, place signature after the message
    return `${textHtml}${signatureBlock}`
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [formData.text])

  // Sync when replyTo or prefill changes
  useEffect(() => {
    if (replyTo) {
      setFormData({
        to: replyTo.to,
        cc: "",
        bcc: "",
        subject: replyTo.subject,
        text: replyTo.originalText || "",
      })
      return
    }
    // Apply prefill if provided
    setFormData({
      to: prefill?.to || "",
      cc: "",
      bcc: "",
      subject: prefill?.subject || "",
      text: prefill?.text || "",
    })
  }, [replyTo, prefill])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.to || !formData.subject) return

    try {
      setSending(true)
      if (replyTo) {
        await replyToEmail({
          ...formData,
          messageId: replyTo.messageId,
          references: replyTo.references,
          attachments,
          html: buildHtmlBody(),
        })
      } else {
        await sendEmail({
          ...formData,
          attachments,
          html: buildHtmlBody(),
        })
      }
      // Reset form and close
      setFormData({ to: "", cc: "", bcc: "", subject: "", text: "" })
      setAttachments([])
      setShowCcBcc(false)
      onClose()
    } catch (error) {
      console.error("Error sending email:", error)
      alert("Failed to send email. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setAttachments((prev) => [...prev, ...files])
  }

  if (!isOpen) return null

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
        {/* Backdrop for maximized mode */}
        {isMaximized && <div className="fixed inset-0 bg-black/20" onClick={() => setIsMaximized(false)} />}

        <div
          className={cn(
            "bg-white rounded-lg shadow-2xl border transition-all duration-300 ease-in-out flex flex-col",
            isMaximized ? "w-[90vw] h-[90vh] max-w-6xl" : isMinimized ? "w-80 h-12" : "w-[600px] h-[600px]",
            "relative z-10",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center z-20">
              <div className="text-center">
                <Paperclip className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-blue-600 font-medium">Drop files to attach</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              {replyTo ? "Reply" : "New Message"}
              {sending && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
            </h3>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(!isMinimized)}>
                    {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMinimized ? "Expand" : "Minimize"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMaximized(!isMaximized)}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMaximized ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close composer</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Recipients Section */}
                <div className="p-4 space-y-3 border-b bg-white">
                  {/* To Field */}
                  <div className="flex items-center gap-3">
                    <Label className="w-12 text-sm text-gray-600 font-medium">To</Label>
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        type="text"
                        value={formData.to}
                        onChange={(e) => handleInputChange("to", e.target.value)}
                        placeholder="Recipients (comma-separated)"
                        className="border-none shadow-none focus-visible:ring-0 p-0 text-sm"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCcBcc(!showCcBcc)}
                        className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 h-auto"
                      >
                        {showCcBcc ? "Hide Cc/Bcc" : "Add Cc/Bcc"}
                      </Button>
                    </div>
                  </div>
                  {/* CC/BCC Fields */}
                  {showCcBcc && (
                    <>
                      <div className="flex items-center gap-3">
                        <Label className="w-12 text-sm text-gray-600 font-medium">Cc</Label>
                        <Input
                          type="text"
                          value={formData.cc}
                          onChange={(e) => handleInputChange("cc", e.target.value)}
                          placeholder="Cc recipients (comma-separated)"
                          className="border-none shadow-none focus-visible:ring-0 p-0 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="w-12 text-sm text-gray-600 font-medium">Bcc</Label>
                        <Input
                          type="text"
                          value={formData.bcc}
                          onChange={(e) => handleInputChange("bcc", e.target.value)}
                          placeholder="Bcc recipients (comma-separated)"
                          className="border-none shadow-none focus-visible:ring-0 p-0 text-sm"
                        />
                      </div>
                    </>
                  )}
                  {/* Subject Field */}
                  <div className="flex items-center gap-3">
                    <Label className="w-12 text-sm text-gray-600 font-medium">Subject</Label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => handleInputChange("subject", e.target.value)}
                      placeholder="Subject"
                      className="border-none shadow-none focus-visible:ring-0 p-0 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 p-2 border-b bg-gray-50">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Bold className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Italic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Italic</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Underline className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Underline</TooltipContent>
                    </Tooltip>
                  </div>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align left</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Align center</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bulleted list</TooltipContent>
                    </Tooltip>
                  </div>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Link className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Insert link</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <Smile className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Insert emoji</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="ml-auto">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>More options</TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Signature toggle */}
                  <div className="pl-2 ml-2 border-l flex items-center gap-2">
                    <Label htmlFor="include-signature" className="text-xs text-gray-600">Signature</Label>
                    <input
                      id="include-signature"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={includeSignature}
                      onChange={(e) => setIncludeSignature(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Message Body */}
                <div className="flex-1 p-4 overflow-hidden">
                  <Textarea
                    ref={textareaRef}
                    value={formData.text}
                    onChange={(e) => handleInputChange("text", e.target.value)}
                    placeholder="Compose email"
                    className="w-full h-full border-none shadow-none focus-visible:ring-0 resize-none p-0 text-sm leading-relaxed"
                    style={{ minHeight: isMaximized ? "400px" : "200px" }}
                    required
                  />
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="px-4 py-3 border-t bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-500"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-white">
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={sending || !formData.to || !formData.subject}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? "Sending..." : "Send"}
                    </Button>
                    <div className="flex items-center gap-1 ml-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Attach files</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert photo</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                            <Clock className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Schedule send</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete draft</TooltipContent>
                    </Tooltip>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-gray-600">
                      Close
                    </Button>
                  </div>
                </div>
              </form>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="*/*"
              />
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
