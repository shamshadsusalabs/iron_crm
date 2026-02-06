const MerchEvent = require('../models/merch/Event')
const cloudinary = require('../utils/cloudinary')

// Create Event
exports.createEvent = async (req, res) => {
  try {
    const userId = req.userId
    const {
      name,
      type = 'one-time',
      startAt,
      recurrence = null,
      interval = null,
      endDate = null,
      audience = [],
      template = '',
      attachments = [],
    } = req.body

    if (!name || !startAt) {
      return res.status(400).json({ message: 'name and startAt are required' })
    }

    // Basic parsing/validation
    const startAtDate = new Date(startAt)
    if (isNaN(startAtDate.getTime())) {
      return res.status(400).json({ message: 'startAt must be a valid ISO date' })
    }

    let normRecurrence = recurrence
    let normInterval = interval
    let normEndDate = endDate

    if (type === 'one-time') {
      normRecurrence = null
      normInterval = null
      normEndDate = null
    } else if (type === 'recurring') {
      if (normRecurrence === 'custom') {
        const num = Number(normInterval)
        if (!num || num < 1) {
          return res.status(400).json({ message: 'interval is required and must be >= 1 for custom recurrence' })
        }
        normInterval = num
      } else {
        normInterval = null
      }

      if (normEndDate) {
        const end = new Date(normEndDate)
        if (isNaN(end.getTime())) {
          return res.status(400).json({ message: 'endDate must be a valid ISO date' })
        }
        if (end < startAtDate) {
          return res.status(400).json({ message: 'endDate must be on/after startAt' })
        }
      }
    }

    // Normalize attachments and audience
    const normAttachments = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && a.file)
          .map((a) => ({ file: String(a.file) }))
      : []

    const normAudience = Array.isArray(audience)
      ? audience.map((s) => String(s))
      : []

    const payload = {
      name,
      type,
      startAt,
      recurrence: normRecurrence,
      interval: normInterval,
      endDate: normEndDate,
      audience: normAudience,
      template,
      attachments: normAttachments,
      createdBy: userId,
    }

    const doc = await MerchEvent.create(payload)
    return res.status(201).json({ message: 'Event created', data: doc })
  } catch (err) {
    console.error('createEvent error', err)
    return res.status(500).json({ message: 'Failed to create event' })
  }
}

// Get Event by ID (ensure ownership)
exports.getEventById = async (req, res) => {
  try {
    const userId = req.userId
    const { id } = req.params
    const doc = await MerchEvent.findOne({ _id: id, createdBy: userId })
    if (!doc) return res.status(404).json({ message: 'Event not found' })
    res.json({ data: doc })
  } catch (err) {
    console.error('getEventById error', err)
    res.status(500).json({ message: 'Failed to fetch event' })
  }
}

// Update Event (partial)
exports.updateEvent = async (req, res) => {
  try {
    const userId = req.userId
    const { id } = req.params
    const update = { ...req.body }

    // Validate for custom recurrence
    if (update.type === 'recurring' && update.recurrence === 'custom' && !update.interval) {
      return res.status(400).json({ message: 'interval is required for custom recurrence' })
    }

    // If switching to one-time, clear recurrence fields
    if (update.type === 'one-time') {
      update.recurrence = null
      update.interval = null
      update.endDate = null
    }

    const doc = await MerchEvent.findOneAndUpdate(
      { _id: id, createdBy: userId },
      update,
      { new: true }
    )
    if (!doc) return res.status(404).json({ message: 'Event not found' })
    res.json({ message: 'Event updated', data: doc })
  } catch (err) {
    console.error('updateEvent error', err)
    res.status(500).json({ message: 'Failed to update event' })
  }
}

// Delete Event
exports.deleteEvent = async (req, res) => {
  try {
    const userId = req.userId
    const { id } = req.params
    const doc = await MerchEvent.findOneAndDelete({ _id: id, createdBy: userId })
    if (!doc) return res.status(404).json({ message: 'Event not found' })
    res.json({ message: 'Event deleted' })
  } catch (err) {
    console.error('deleteEvent error', err)
    res.status(500).json({ message: 'Failed to delete event' })
  }
}

// Upload attachment to Cloudinary (expects multer memory file under field name 'file')
exports.uploadAttachment = async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file provided' })

    const folder = 'crm/events'
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder },
        (err, result) => {
          if (err) return reject(err)
          resolve(result)
        }
      )
      stream.end(file.buffer)
    })

    // @ts-ignore
    const { secure_url, public_id, resource_type, bytes, format } = uploadResult || {}
    res.json({
      url: secure_url,
      publicId: public_id,
      resourceType: resource_type,
      size: bytes,
      format,
    })
  } catch (err) {
    console.error('uploadAttachment error', err)
    res.status(500).json({ message: 'Failed to upload attachment' })
  }
}

  

// List Events (with basic pagination)
exports.listEvents = async (req, res) => {
  try {
    const userId = req.userId
    const page = parseInt(req.query.page || '1', 10)
    const limit = parseInt(req.query.limit || '10', 10)

    const query = { createdBy: userId }

    const [items, total] = await Promise.all([
      MerchEvent.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      MerchEvent.countDocuments(query),
    ])

    res.json({
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('listEvents error', err)
    res.status(500).json({ message: 'Failed to fetch events' })
  }
}
