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

    if (type === 'recurring' && recurrence === 'custom' && !interval) {
      return res.status(400).json({ message: 'interval is required for custom recurrence' })
    }

    const doc = await MerchEvent.create({
      name,
      type,
      startAt,
      recurrence: type === 'recurring' ? recurrence : null,
      interval: type === 'recurring' ? interval : null,
      endDate: type === 'recurring' ? endDate : null,
      audience,
      template,
      attachments,
      createdBy: userId,
    })

    return res.status(201).json({ message: 'Event created', data: doc })
  } catch (err) {
    console.error('createEvent error', err)
    res.status(500).json({ message: 'Failed to create event' })
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

    if (update.type === 'recurring' && update.recurrence === 'custom' && !update.interval) {
      return res.status(400).json({ message: 'interval is required for custom recurrence' })
    }

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
