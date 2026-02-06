const Imap = require("imap")
const nodemailer = require("nodemailer")
const { simpleParser } = require("mailparser")
const emailConfig = require("../config/emailConfig")
const logger = require("../utils/logger")

// Merge override config (from user/admin settings) with fallback env config
function getEffectiveConfig(override = {}) {
  const cfg = {
    user: override.user || emailConfig.user,
    password: override.password || emailConfig.password,
    imapHost: override.imapHost || emailConfig.imapHost || "imap.gmail.com",
    imapPort: override.imapPort || emailConfig.imapPort || 993,
    smtpHost: override.smtpHost || emailConfig.smtpHost || "smtp.gmail.com",
    smtpPort: override.smtpPort || emailConfig.smtpPort || 465,
    fromName: override.fromName,
  }
  return cfg
}

// Default pooled transporter for env config
let defaultTransporter = null
function ensureDefaultTransporter() {
  if (defaultTransporter) return defaultTransporter
  defaultTransporter = nodemailer.createTransport({
    host: emailConfig.smtpHost || "smtp.gmail.com",
    port: emailConfig.smtpPort || 465,
    secure: (emailConfig.smtpPort || 465) === 465,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
    tls: { rejectUnauthorized: false },
  })
  return defaultTransporter
}

// Build transporter for a specific config; reuse default when same as env
function getTransporter(effectiveCfg) {
  const sameAsEnv =
    effectiveCfg.user === emailConfig.user &&
    effectiveCfg.password === emailConfig.password &&
    (effectiveCfg.smtpHost || "smtp.gmail.com") === (emailConfig.smtpHost || "smtp.gmail.com") &&
    (effectiveCfg.smtpPort || 465) === (emailConfig.smtpPort || 465)

  if (sameAsEnv) return ensureDefaultTransporter()

  return nodemailer.createTransport({
    host: effectiveCfg.smtpHost || "smtp.gmail.com",
    port: effectiveCfg.smtpPort || 465,
    secure: (effectiveCfg.smtpPort || 465) === 465,
    pool: false,
    auth: {
      user: effectiveCfg.user,
      pass: effectiveCfg.password,
    },
    tls: { rejectUnauthorized: false },
  })
}

// Mock email data for development
const mockEmails = [
  {
    threadId: "thread1",
    emails: [
      {
        uid: "email1",
        headers: {
          from: ["John Doe <john@example.com>"],
          to: ["me@example.com"],
          subject: ["Welcome to our service"],
          date: ["2024-01-15T10:30:00Z"],
          "message-id": ["<msg1@example.com>"]
        },
        body: {
          text: "Welcome to our service! We're excited to have you on board.",
          html: "<p>Welcome to our service! We're excited to have you on board.</p>"
        },
        attachments: []
      }
    ]
  },
  {
    threadId: "thread2", 
    emails: [
      {
        uid: "email2",
        headers: {
          from: ["Jane Smith <jane@company.com>"],
          to: ["me@example.com"],
          subject: ["Meeting tomorrow"],
          date: ["2024-01-14T15:45:00Z"],
          "message-id": ["<msg2@example.com>"]
        },
        body: {
          text: "Hi, let's meet tomorrow at 2 PM to discuss the project.",
          html: "<p>Hi, let's meet tomorrow at 2 PM to discuss the project.</p>"
        },
        attachments: []
      }
    ]
  }
]

// Email parsing utility functions
function htmlToText(html) {
  if (!html) return ""

  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")

  // Replace common HTML entities
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
  }

  Object.keys(entities).forEach((entity) => {
    text = text.replace(new RegExp(entity, "g"), entities[entity])
  })

  // Replace HTML tags with appropriate text
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<\/p>/gi, "\n\n")
  text = text.replace(/<\/div>/gi, "\n")
  text = text.replace(/<\/h[1-6]>/gi, "\n\n")
  text = text.replace(/<li[^>]*>/gi, "• ")
  text = text.replace(/<\/li>/gi, "\n")

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "")

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n")
  text = text.replace(/[ \t]+/g, " ")
  text = text.trim()

  return text
}

function parseEmailBody(rawBody) {
  return new Promise((resolve) => {
    // Use mailparser to properly parse the email
    simpleParser(rawBody, (err, parsed) => {
      if (err) {
        logger.error("Error parsing email:", { error: err.message })
        resolve({
          textContent: rawBody,
          htmlContent: null,
          attachments: [],
        })
        return
      }

      const result = {
        textContent: "",
        htmlContent: null,
        attachments: [],
      }

      // Get text content
      if (parsed.text) {
        result.textContent = parsed.text
      } else if (parsed.html) {
        result.textContent = htmlToText(parsed.html)
      }

      // Get HTML content
      if (parsed.html) {
        result.htmlContent = parsed.html
      }

      // Process attachments
      if (parsed.attachments && parsed.attachments.length > 0) {
        result.attachments = parsed.attachments.map((att) => ({
          filename: att.filename || "unnamed",
          contentType: att.contentType || "application/octet-stream",
          size: att.size || 0,
          contentId: att.cid || null,
          base64Data: att.content ? att.content.toString("base64") : "",
        }))
      }

      resolve(result)
    })
  })
}

async function fetchSpamMails({ page = 1, limit = 10, search = "" }, configOverride = {}) {
  return new Promise((resolve, reject) => {
    const cfg = getEffectiveConfig(configOverride)
    // Check if email config is available
    if (!cfg.user || !cfg.password) {

      let mockData = [...mockEmails]

      // Filter by search if needed
      if (search) {
        const s = search.toLowerCase()
        mockData = mockData.filter((thread) =>
          thread.emails.some((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = ((e.body && e.body.text) || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          }),
        )
      }

      // Apply pagination
      const start = (page - 1) * limit
      const end = start + limit
      const paginatedData = mockData.slice(start, end)

      resolve(paginatedData)
      return
    }

    const imapConnection = new Imap({
      user: cfg.user,
      password: cfg.password,
      host: cfg.imapHost,
      port: cfg.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 10000,
    })

    imapConnection.once("ready", async () => {
      try {
        // Gmail Spam mailbox name
        const spamEmails = await fetchEmailsFromFolder(imapConnection, "[Gmail]/Spam", 1, "*")

        let filtered = spamEmails
        if (search) {
          const s = search.toLowerCase()
          filtered = spamEmails.filter((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.textContent || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          })
        }

        const grouped = groupEmailsByThread(filtered)
        const start = (page - 1) * limit
        const end = start + limit
        const paginated = grouped.slice(start, end)

        // Format response
        const formattedThreads = paginated.map((thread) => ({
          threadId: thread[0].threadId,
          emails: thread.map((email) => ({
            headers: email.headers,
            body: email.textContent,
            htmlContent: email.htmlContent,
            attachments: email.attachments,
            seqno: email.seqno,
            uid: email.uid,
            threadId: email.threadId,
            _debugThreadId: email._debugThreadId,
          })),
        }))

        resolve(formattedThreads)
      } catch (err) {
        reject(err)
      } finally {
        imapConnection.end()
      }
    })

    imapConnection.once("error", (err) => {
      logger.error('IMAP connection error', {
        emailUser: cfg.user,
        host: cfg.imapHost,
        port: cfg.imapPort,
        error: err.message
      })
      reject(err)
    })
    imapConnection.connect()
  })
}

function fetchEmailsFromFolder(imapConnection, folder, opts = {}) {
  return new Promise((resolve, reject) => {
    const emails = []
    const t0 = Date.now()

    imapConnection.openBox(folder, false, (err, box) => {
      if (err) {
        logger.error('IMAP openBox error', { folder, error: err.message })
        return reject(err)
      }
      if (box.messages.total === 0) {
        logger.debug('IMAP folder empty', { folder })
        return resolve([])
      }

      const total = box.messages.total
      const FETCH_LIMIT = Math.max(1, Math.min(100, Number(opts.fetchLimit) || 100))
      const rangeStart = Math.max(1, total - FETCH_LIMIT + 1)
      const rangeEnd = total
      logger.debug('IMAP fetching range', { folder, total, rangeStart, rangeEnd, fetchLimit: FETCH_LIMIT })
      const fetch = imapConnection.seq.fetch(`${rangeStart}:${rangeEnd}`, {
        bodies: "",
        struct: true,
      })

      fetch.on("message", (msg, seqno) => {
        const email = {
          headers: {},
          rawBody: "",
          seqno: seqno,
          uid: null,
          threadId: null,
        }

        msg.on("body", (stream, info) => {
          let buffer = ""
          stream.on("data", (chunk) => {
            buffer += chunk.toString("utf8")
          })

          stream.once("end", () => {
            email.rawBody = buffer
          })
        })

        msg.once("attributes", (attrs) => {
          email.uid = attrs.uid
          if (attrs["x-gm-thrid"]) {
            email.threadId = String(attrs["x-gm-thrid"])
          } else {
            email.threadId = null
          }
        })

        msg.once("end", () => {
          emails.push(email)
        })
      })

      fetch.once("error", (err) => {
        logger.error('IMAP fetch error', { folder, error: err.message })
        reject(err)
      })

      fetch.once("end", async () => {
        // Parse all emails
        const parsedEmails = []

        for (const email of emails) {
          try {
            const parsedBody = await parseEmailBody(email.rawBody)

            // Parse headers using simpleParser
            const parsed = await new Promise((resolve) => {
              simpleParser(email.rawBody, (err, result) => {
                if (err) {
                  resolve({
                    from: ["Unknown"],
                    to: ["Unknown"],
                    subject: ["No Subject"],
                    date: [new Date().toISOString()],
                    "message-id": [email.uid.toString()],
                    references: [],
                  })
                } else {
                  resolve({
                    from: [result.from ? result.from.text : "Unknown"],
                    to: result.to ? result.to.text.split(",") : ["Unknown"],
                    subject: [result.subject || "No Subject"],
                    date: [result.date ? result.date.toISOString() : new Date().toISOString()],
                    "message-id": [result.messageId || email.uid.toString()],
                    references: result.references ? [result.references] : [],
                    cc: result.cc ? result.cc.text.split(",") : undefined,
                  })
                }
              })
            })

            parsedEmails.push({
              headers: parsed,
              textContent: parsedBody.textContent,
              htmlContent: parsedBody.htmlContent,
              attachments: parsedBody.attachments,
              seqno: email.seqno,
              uid: email.uid,
              threadId: email.threadId || email.uid.toString(),
              _debugThreadId: email.threadId || email.uid.toString(),
            })
          } catch (error) {
            logger.error("Error parsing email:", { error: error.message })
            // Add fallback email
            parsedEmails.push({
              headers: {
                from: ["Unknown"],
                to: ["Unknown"],
                subject: ["Parse Error"],
                date: [new Date().toISOString()],
                "message-id": [email.uid.toString()],
              },
              textContent: "Error parsing email content",
              htmlContent: null,
              attachments: [],
              seqno: email.seqno,
              uid: email.uid,
              threadId: email.threadId || email.uid.toString(),
              _debugThreadId: email.threadId || email.uid.toString(),
            })
          }
        }

        // Sort by date
        parsedEmails.sort((a, b) => {
          const dateA = new Date(a.headers.date[0])
          const dateB = new Date(b.headers.date[0])
          return dateB - dateA
        })

        const dt = Date.now() - t0
        logger.debug('IMAP fetch complete', { folder, fetched: emails.length, parsed: parsedEmails.length, ms: dt })
        resolve(parsedEmails)
      })
    })
  })
}

function groupEmailsByThread(emails) {
  const threadMap = new Map()

  for (const email of emails) {
    let threadId = email.threadId
    if (!threadId && email.headers["message-id"] && email.headers["message-id"][0]) {
      threadId = email.headers["message-id"][0]
    }
    if (!threadId) {
      threadId = String(email.uid)
    }

    if (!threadMap.has(threadId)) threadMap.set(threadId, [])
    email._debugThreadId = threadId
    threadMap.get(threadId).push(email)
  }

  return Array.from(threadMap.values())
}

async function fetchAllMails({ page = 1, limit = 10, search = "" }, configOverride = {}) {
  return new Promise((resolve, reject) => {
    const cfg = getEffectiveConfig(configOverride)
    // Check if email config is available
    if (!cfg.user || !cfg.password) {
      logger.debug("Email config not available, using mock data")
      let mockData = [...mockEmails]
      
      // Filter by search if needed
      if (search) {
        const s = search.toLowerCase()
        mockData = mockData.filter((thread) =>
          thread.emails.some((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.body.text || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          }),
        )
      }
      
      // Apply pagination
      const start = (page - 1) * limit
      const end = start + limit
      const paginatedData = mockData.slice(start, end)
      
      resolve(paginatedData)
      return
    }

    const imapConnection = new Imap({
      user: cfg.user,
      password: cfg.password,
      host: cfg.imapHost,
      port: cfg.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    let allEmails = []
    // Debug: IMAP connect start
    logger.debug('IMAP connect start', {
      emailUser: cfg.user,
      host: cfg.imapHost,
      port: cfg.imapPort,
      folders: ['INBOX', '[Gmail]/Sent Mail']
    })

    imapConnection.once("ready", async () => {
      try {
        // Fetch from both INBOX and [Gmail]/Sent Mail
        const fetchLimit = Math.min(100, Math.max(10, (page || 1) * (limit || 10)))
        const inboxEmails = await fetchEmailsFromFolder(imapConnection, "INBOX", { fetchLimit })
        const sentEmails = await fetchEmailsFromFolder(imapConnection, "[Gmail]/Sent Mail", { fetchLimit })

        allEmails = [...inboxEmails, ...sentEmails]

        // Remove duplicate threads (by threadId)
        const threadMap = new Map()
        for (const email of allEmails) {
          let threadId = email.threadId
          if (!threadId && email.headers["message-id"] && email.headers["message-id"][0]) {
            threadId = email.headers["message-id"][0]
          }
          if (!threadId) {
            threadId = String(email.uid)
          }

          if (!threadMap.has(threadId)) threadMap.set(threadId, [])
          threadMap.get(threadId).push(email)
        }

        let grouped = Array.from(threadMap.values())

        // Filter by search if needed
        if (search) {
          const s = search.toLowerCase()
          grouped = grouped.filter((thread) =>
            thread.some((e) => {
              const subj = (e.headers.subject[0] || "").toLowerCase()
              const from = (e.headers.from[0] || "").toLowerCase()
              const content = (e.textContent || "").toLowerCase()
              return subj.includes(s) || from.includes(s) || content.includes(s)
            }),
          )
        }

        // Sort threads by latest email date
        grouped.sort((a, b) => {
          const dateA = new Date(a[0].headers.date[0])
          const dateB = new Date(b[0].headers.date[0])
          return dateB - dateA
        })

        // Pagination
        const start = (page - 1) * limit
        const end = start + limit
        const paginated = grouped.slice(start, end)

        // Format response
        const formattedThreads = paginated.map((thread) => ({
          threadId: thread[0].threadId,
          emails: thread.map((email) => ({
            headers: email.headers,
            body: email.textContent, // Send clean text content
            htmlContent: email.htmlContent, // Send HTML separately
            attachments: email.attachments, // Send parsed attachments
            seqno: email.seqno,
            uid: email.uid,
            threadId: email.threadId,
            _debugThreadId: email._debugThreadId,
          })),
        }))

        resolve(formattedThreads)
      } catch (err) {
        reject(err)
      } finally {
        imapConnection.end()
      }
    })

    imapConnection.once("error", (err) => reject(err))
    imapConnection.connect()
  })
}

async function fetchSentMails({ page = 1, limit = 10, search = "" }, configOverride = {}) {
  return new Promise((resolve, reject) => {
    const cfg = getEffectiveConfig(configOverride)
    // Check if email config is available
    if (!cfg.user || !cfg.password) {
      logger.debug("Email config not available, using mock data for sent mails")
      let mockData = [...mockEmails]
      
      // Filter by search if needed
      if (search) {
        const s = search.toLowerCase()
        mockData = mockData.filter((thread) =>
          thread.emails.some((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.body.text || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          }),
        )
      }
      
      // Apply pagination
      const start = (page - 1) * limit
      const end = start + limit
      const paginatedData = mockData.slice(start, end)
      
      resolve(paginatedData)
      return
    }

    const imapConnection = new Imap({
      user: cfg.user,
      password: cfg.password,
      host: cfg.imapHost,
      port: cfg.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    let allEmails = []

    imapConnection.once("ready", async () => {
      try {
        const fetchLimit = Math.min(100, Math.max(10, (page || 1) * (limit || 10)))
        const sentEmails = await fetchEmailsFromFolder(imapConnection, "[Gmail]/Sent Mail", { fetchLimit })
        const inboxEmails = await fetchEmailsFromFolder(imapConnection, "INBOX", { fetchLimit })

        const sentThreadIds = new Set(sentEmails.map((e) => e.threadId).filter(Boolean))
        allEmails = [...sentEmails, ...inboxEmails.filter((e) => e.threadId && sentThreadIds.has(e.threadId))]

        let filtered = allEmails
        if (search) {
          const s = search.toLowerCase()
          filtered = allEmails.filter((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.textContent || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          })
        }

        const grouped = groupEmailsByThread(filtered)
        const start = (page - 1) * limit
        const end = start + limit
        const paginated = grouped.slice(start, end)

        // Format response
        const formattedThreads = paginated.map((thread) => ({
          threadId: thread[0].threadId,
          emails: thread.map((email) => ({
            headers: email.headers,
            body: email.textContent,
            htmlContent: email.htmlContent,
            attachments: email.attachments,
            seqno: email.seqno,
            uid: email.uid,
            threadId: email.threadId,
            _debugThreadId: email._debugThreadId,
          })),
        }))

        resolve(formattedThreads)
      } catch (err) {
        reject(err)
      } finally {
        imapConnection.end()
      }
    })

    imapConnection.once("error", (err) => reject(err))
    imapConnection.connect()
  })
}

async function fetchReceivedMails({ page = 1, limit = 10, search = "" }, configOverride = {}) {
  return new Promise((resolve, reject) => {
    const cfg = getEffectiveConfig(configOverride)
    // Check if email config is available
    if (!cfg.user || !cfg.password) {
      logger.debug("Email config not available, using mock data for received mails")
      let mockData = [...mockEmails]
      
      // Filter by search if needed
      if (search) {
        const s = search.toLowerCase()
        mockData = mockData.filter((thread) =>
          thread.emails.some((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.body.text || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          }),
        )
      }
      
      // Apply pagination
      const start = (page - 1) * limit
      const end = start + limit
      const paginatedData = mockData.slice(start, end)
      
      resolve(paginatedData)
      return
    }

    const imapConnection = new Imap({
      user: cfg.user,
      password: cfg.password,
      host: cfg.imapHost,
      port: cfg.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    let allEmails = []

    imapConnection.once("ready", async () => {
      try {
        const fetchLimit = Math.min(100, Math.max(10, (page || 1) * (limit || 10)))
        const inboxEmails = await fetchEmailsFromFolder(imapConnection, "INBOX", { fetchLimit })
        const sentEmails = await fetchEmailsFromFolder(imapConnection, "[Gmail]/Sent Mail", { fetchLimit })

        const receivedThreadIds = new Set(inboxEmails.map((e) => e.threadId).filter(Boolean))
        allEmails = [...inboxEmails, ...sentEmails.filter((e) => e.threadId && receivedThreadIds.has(e.threadId))]

        let filtered = allEmails
        if (search) {
          const s = search.toLowerCase()
          filtered = allEmails.filter((e) => {
            const subj = (e.headers.subject[0] || "").toLowerCase()
            const from = (e.headers.from[0] || "").toLowerCase()
            const content = (e.textContent || "").toLowerCase()
            return subj.includes(s) || from.includes(s) || content.includes(s)
          })
        }

        const grouped = groupEmailsByThread(filtered)
        const start = (page - 1) * limit
        const end = start + limit
        const paginated = grouped.slice(start, end)

        // Format response
        const formattedThreads = paginated.map((thread) => ({
          threadId: thread[0].threadId,
          emails: thread.map((email) => ({
            headers: email.headers,
            body: email.textContent,
            htmlContent: email.htmlContent,
            attachments: email.attachments,
            seqno: email.seqno,
            uid: email.uid,
            threadId: email.threadId,
            _debugThreadId: email._debugThreadId,
          })),
        }))

        resolve(formattedThreads)
      } catch (err) {
        reject(err)
      } finally {
        imapConnection.end()
      }
    })

    imapConnection.once("error", (err) => reject(err))
    imapConnection.connect()
  })
}

async function sendEmail({ to, cc, bcc, subject, text, html, attachments }, configOverride = {}) {
  let cfg
  try {
    cfg = getEffectiveConfig(configOverride)
    if (!cfg.user || !cfg.password) {
      throw new Error('Email configuration is missing. Please check emailConfig.user and emailConfig.password');
    }

    if (!to) {
      throw new Error('Recipient email address is required');
    }

    const fromAddr = cfg.fromName ? `${cfg.fromName} <${cfg.user}>` : cfg.user
    const mailOptions = {
      from: fromAddr,
      replyTo: cfg.user,
      to,
      cc: cc || "",
      bcc: bcc || "",
      subject: subject || "No Subject",
      text: text || "No message body",
      html: html || undefined,
      attachments: attachments || [],
    }

    logger.debug('Sending email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from
    });

    const tx = getTransporter(cfg)
    const info = await tx.sendMail(mailOptions)
    logger.info('Email sent successfully', { messageId: info.messageId })
    logger.info("SMTP send result", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
    return info
  } catch (error) {
    const safe = cfg || {}
    logger.error('Error sending email', {
      error: error.message,
      to,
      subject,
      emailConfig: {
        user: safe.user ? 'Set' : 'Not set',
        password: safe.password ? 'Set' : 'Not set'
      }
    });
    throw error;
  }
}

async function replyToEmail({ to, cc, bcc, subject, text, html, messageId, references, attachments }, configOverride = {}) {
  const cfg = getEffectiveConfig(configOverride)
  const fromAddr = cfg.fromName ? `${cfg.fromName} <${cfg.user}>` : cfg.user
  const mailOptions = {
    from: fromAddr,
    to,
    cc: cc || "",
    bcc: bcc || "",
    subject: subject.startsWith("Re:") ? subject : "Re: " + subject,
    text,
    html: html || undefined,
    inReplyTo: `<${messageId}>`,
    references: references ? `${references} <${messageId}>` : `<${messageId}>`,
    attachments: attachments || [],
  }

  const tx = getTransporter(cfg)
  const info = await tx.sendMail(mailOptions)
  return info
}

module.exports = {
  fetchAllMails,
  fetchSentMails,
  fetchReceivedMails,
  fetchSpamMails,
  sendEmail,
  replyToEmail,
}

// Add Spam fetcher (placed after exports for diff clarity; actual export added below)

