"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { ApiResponse, EmailThread } from "../types/email"

// Prefer Vite env for API base; fallback to localhost for dev
const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? "https://crmbackend-469714.el.r.appspot.com"}/api/emails`

// Helper to attach Authorization header when token is present
function buildHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Detect merch context by pathname; emails API accepts both roles via anyAuth
function isMerch(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/merchandiser')
}

// Pick the right token based on context. Prefer merch token on merch UI
function getAccessToken(): string {
  if (typeof window === 'undefined') return ''
  const merch = localStorage.getItem('merchAccessToken') || ''
  const admin = localStorage.getItem('accessToken') || localStorage.getItem('adminAccessToken') || localStorage.getItem('token') || ''
  return isMerch() ? (merch || admin) : (admin || merch)
}

export type MailboxType = "all" | "sent" | "received" | "spam"

export function useEmails() {
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalThreads, setTotalThreads] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentMailbox, setCurrentMailbox] = useState<MailboxType>("received")

  // Lightweight in-hook cache to avoid repeated calls on tab switches
  // Key format: `${mailbox}|${currentPage}|${search}`
  const cacheRef = useRef<Map<string, { data: EmailThread[]; total: number; expiresAt: number }>>(new Map())
  const pendingRef = useRef<Map<string, Promise<void>>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const CACHE_TTL_MS = 60_000 // 60s TTL

  const fetchEmails = useCallback(async (mailbox: MailboxType, currentPage = 1, search = "") => {
    const key = `${mailbox}|${currentPage}|${search}`

    // Serve from cache if fresh
    const cached = cacheRef.current.get(key)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      setThreads(cached.data)
      setTotalThreads(cached.total)
      setCurrentMailbox(mailbox)
      setPage(currentPage)
      setSearchQuery(search)
      setLoading(false)
      return
    }

    // De-duplicate concurrent requests for the same key
    const pendingExisting = pendingRef.current.get(key)
    if (pendingExisting) {
      setLoading(true)
      await pendingExisting
      return
    }

    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    const run = (async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "10",
        })

        if (search) {
          params.append("search", search)
        }

        const url = `${API_BASE_URL}/${mailbox}?${params}`
        console.log(`Fetching emails from: ${url}`)
        const token = getAccessToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await fetch(url, { signal: controller.signal, headers })

        if (!response.ok) {
          throw new Error(`Failed to fetch emails: ${response.status}`)
        }

        const apiResponse: ApiResponse = await response.json()

        if (!(apiResponse as any).success) {
          throw new Error((apiResponse as any).message || "Failed to fetch emails")
        }

        const data = (apiResponse as any).data || []
        const total = (apiResponse as any).pagination?.total ?? (apiResponse as any).totalThreads ?? (data.length ?? 0)

        // Update state
        setThreads(data)
        setTotalThreads(total)
        setCurrentMailbox(mailbox)
        setPage(currentPage)
        setSearchQuery(search)

        // Cache result
        cacheRef.current.set(key, { data, total, expiresAt: Date.now() + CACHE_TTL_MS })
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Swallow abort errors
          return
        }
        console.error("Error fetching emails:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
        setThreads([])
        setTotalThreads(0)
      } finally {
        setLoading(false)
        pendingRef.current.delete(key)
      }
    })()

    pendingRef.current.set(key, run)
    await run
  }, [])

  const sendEmail = async (emailData: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    text: string
    html?: string
    attachments?: File[]
  }) => {
    try {
      let response: Response

      // If there are attachments, use FormData
      if (emailData.attachments && emailData.attachments.length > 0) {
        const formData = new FormData()
        formData.append("to", emailData.to)
        if (emailData.cc) formData.append("cc", emailData.cc)
        if (emailData.bcc) formData.append("bcc", emailData.bcc)
        formData.append("subject", emailData.subject)
        formData.append("text", emailData.text)
        if (emailData.html) formData.append("html", emailData.html)

        // Handle file attachments
        emailData.attachments.forEach((file) => {
          formData.append("attachments", file)
        })

        const token = getAccessToken()
        const headers = buildHeaders(token)
        response = await fetch(`${API_BASE_URL}/send-email`, {
          method: "POST",
          body: formData,
          headers,
        })
      } else {
        // If no attachments, send JSON
        const token = getAccessToken()
        const headers = {
          "Content-Type": "application/json",
          ...buildHeaders(token),
        }
        response = await fetch(`${API_BASE_URL}/send-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: emailData.to,
            cc: emailData.cc || "",
            bcc: emailData.bcc || "",
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html || "",
          }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to send email")
      }

      const result = await response.json()

      // Refresh emails after sending
      await fetchEmails(currentMailbox, page, searchQuery)
      return result
    } catch (err) {
      console.error("Send email error:", err)
      throw new Error(err instanceof Error ? err.message : "Failed to send email")
    }
  }

  const replyToEmail = async (replyData: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    text: string
    html?: string
    messageId: string
    references?: string
    attachments?: File[]
  }) => {
    try {
      let response: Response

      // If there are attachments, use FormData
      if (replyData.attachments && replyData.attachments.length > 0) {
        const formData = new FormData()
        formData.append("to", replyData.to)
        if (replyData.cc) formData.append("cc", replyData.cc)
        if (replyData.bcc) formData.append("bcc", replyData.bcc)
        formData.append("subject", replyData.subject)
        formData.append("text", replyData.text)
        if (replyData.html) formData.append("html", replyData.html)
        formData.append("messageId", replyData.messageId)
        if (replyData.references) formData.append("references", replyData.references)

        // Handle file attachments
        replyData.attachments.forEach((file) => {
          formData.append("attachments", file)
        })

        const token = getAccessToken()
        const headers = buildHeaders(token)
        response = await fetch(`${API_BASE_URL}/reply-email`, {
          method: "POST",
          body: formData,
          headers,
        })
      } else {
        // If no attachments, send JSON
        const token = getAccessToken()
        const headers = {
          "Content-Type": "application/json",
          ...buildHeaders(token),
        }
        response = await fetch(`${API_BASE_URL}/reply-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: replyData.to,
            cc: replyData.cc || "",
            bcc: replyData.bcc || "",
            subject: replyData.subject,
            text: replyData.text,
            html: replyData.html || "",
            messageId: replyData.messageId,
            references: replyData.references || "",
          }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to send reply")
      }

      const result = await response.json()

      // Refresh emails after replying
      await fetchEmails(currentMailbox, page, searchQuery)
      return result
    } catch (err) {
      console.error("Reply email error:", err)
      throw new Error(err instanceof Error ? err.message : "Failed to send reply")
    }
  }

  const switchMailbox = useCallback(
    async (mailbox: MailboxType) => {
      console.log(`Switching to mailbox: ${mailbox}`)
      await fetchEmails(mailbox, 1, "")
    },
    [fetchEmails],
  )

  const searchEmails = useCallback(
    async (query: string) => {
      console.log(`Searching emails: ${query} in ${currentMailbox}`)
      await fetchEmails(currentMailbox, 1, query)
    },
    [currentMailbox, fetchEmails],
  )

  const nextPage = useCallback(async () => {
    const newPage = page + 1
    await fetchEmails(currentMailbox, newPage, searchQuery)
  }, [currentMailbox, page, searchQuery, fetchEmails])

  const prevPage = useCallback(async () => {
    if (page > 1) {
      const newPage = page - 1
      await fetchEmails(currentMailbox, newPage, searchQuery)
    }
  }, [currentMailbox, page, searchQuery, fetchEmails])

  const refresh = useCallback(async () => {
    await fetchEmails(currentMailbox, page, searchQuery)
  }, [currentMailbox, page, searchQuery, fetchEmails])

  useEffect(() => {
    fetchEmails("received", 1, "")
  }, [fetchEmails])

  // Listen to Server-Sent Events for lightweight realtime updates
  useEffect(() => {
    const rawBase = import.meta.env.VITE_API_URL ?? "https://crmbackend-469714.el.r.appspot.com"
    const token = getAccessToken()
    const streamUrl = `${rawBase}/api/emails/stream${token ? `?accessToken=${encodeURIComponent(token)}` : ""}`
    const es = new EventSource(streamUrl, { withCredentials: true })

    const handleEmailNew = (payloadStr: string) => {
      try {
        const payload = JSON.parse(payloadStr || '{}') as { mailbox?: MailboxType }
        const impactedMailbox = (payload.mailbox as MailboxType) || 'received'
        // Only refresh if the event matches current mailbox, or if it's 'all'
        if (impactedMailbox === currentMailbox || impactedMailbox === 'all') {
          const key = `${currentMailbox}|${page}|${searchQuery}`
          cacheRef.current.delete(key)
          // Trigger a single refresh for current view
          fetchEmails(currentMailbox, page, searchQuery)
        }
      } catch (e) {
        console.warn('SSE parse error:', e)
      }
    }

    es.addEventListener('email_new', (e: MessageEvent) => handleEmailNew(e.data))
    es.addEventListener('ping', () => { })
    es.onerror = () => {
      // Let EventSource auto-reconnect; no action needed
    }

    return () => {
      es.close()
    }
  }, [currentMailbox, page, searchQuery, fetchEmails])

  return {
    threads,
    loading,
    error,
    page,
    totalThreads,
    searchQuery,
    currentMailbox,
    fetchEmails,
    sendEmail,
    replyToEmail,
    switchMailbox,
    searchEmails,
    nextPage,
    prevPage,
    refresh,
  }
}
