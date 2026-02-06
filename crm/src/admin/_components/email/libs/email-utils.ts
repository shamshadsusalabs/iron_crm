type Email = {
  body: string
  htmlContent?: string
}

export function decodeBase64Body(body: string): string {
  try {
    // If htmlContent is available, prefer that
    if (body.includes("<")) {
      return body
    }

    // Extract base64 content from email body
    const base64Match = body.match(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/)
    if (base64Match) {
      const base64Content = base64Match[1].replace(/\r?\n/g, "")
      return atob(base64Content)
    }

    // If no base64, try to extract plain text
    const textMatch = body.match(/Content-Type: text\/plain[^]*?\r?\n\r?\n([^]*?)(?=\r?\n--|\r?\n$)/)
    if (textMatch) {
      return textMatch[1]
    }

    return body
  } catch (error) {
    console.error("Error decoding email body:", error)
    return body
  }
}

export function parseEmailBody(email: Email): string {
  // Prefer htmlContent if available
  if (email.htmlContent) {
    // Strip HTML tags for preview
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = email.htmlContent
    return tempDiv.textContent || tempDiv.innerText || ""
  }

  // Fallback to body parsing
  return decodeBase64Body(email.body)
}

export function getEmailHtmlContent(email: Email): string {
  return email.htmlContent || decodeBase64Body(email.body)
}

export function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/)
  return match ? match[1] : emailString
}

export function extractDisplayName(emailString: string): string {
  const match = emailString.match(/^([^<]+)</) || emailString.match(/^([^\s@]+)/)
  return match ? match[1].trim().replace(/"/g, "") : emailString
}

export function formatEmailTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffInHours < 24) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } else if (diffInHours < 24 * 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    })
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
