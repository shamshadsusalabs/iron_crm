const express = require('express')
const router = express.Router()
const { verifyMerchAccessToken } = require('../middleware/merchAuthMiddleware')
const CustomerEnquiry = require('../models/enquiry')
const multer = require('multer')
const XLSX = require('xlsx')

// All routes require merch access token
router.use(verifyMerchAccessToken)

// Helper: build search query
function buildQuery(userId, query) {
  const { page = 1, limit = 10, search = '', status, priority } = query
  const q = { createdBy: userId }
  if (status) q.status = status
  if (priority) q.priority = priority
  if (search) {
    q.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
      { products: { $elemMatch: { $regex: search, $options: 'i' } } },
    ]
  }
  return { q, page: Number(page), limit: Number(limit) }
}

// List (only own enquiries)
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId
    const { q, page, limit } = buildQuery(userId, req.query)
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      CustomerEnquiry.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email'),
      CustomerEnquiry.countDocuments(q),
    ])

    res.json({ items, total, page, limit })
  } catch (err) {
    next(err)
  }
})

// Create (sets creator as merch user)
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId
    const data = req.body || {}

    const created = await CustomerEnquiry.create({
      ...data,
      createdBy: userId,
      createdByModel: 'User',
    })
    const populated = await CustomerEnquiry.findById(created._id).populate('createdBy', 'name email')
    res.status(201).json(populated)
  } catch (err) {
    next(err)
  }
})

// Update (only own enquiries)
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.userId
    const { id } = req.params
    const data = req.body || {}

    const existing = await CustomerEnquiry.findOne({ _id: id, createdBy: userId })
    if (!existing) return res.status(404).json({ message: 'Enquiry not found' })

    const updated = await CustomerEnquiry.findByIdAndUpdate(id, data, { new: true })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// Delete (only own enquiries)
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId
    const { id } = req.params

    const existing = await CustomerEnquiry.findOne({ _id: id, createdBy: userId })
    if (!existing) return res.status(404).json({ message: 'Enquiry not found' })

    await CustomerEnquiry.findByIdAndDelete(id)
    res.json({ message: 'Enquiry deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router

// Excel upload for merch user (bulk insert scoped to owner)
const upload = multer({ storage: multer.memoryStorage() })
router.post('/upload-excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    const docs = []
    for (const r of rows) {
      const name = r.name || r.Name || ''
      const email = (r.email || r.Email || '').toString().toLowerCase()
      const phone = r.phone || r.Phone || ''
      const productsRaw = r.products || r.Products || ''
      const products = Array.isArray(productsRaw)
        ? productsRaw
        : typeof productsRaw === 'string' && productsRaw.trim()
        ? productsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : []
      const priority = r.priority || r.Priority || 'Medium'
      const status = r.status || r.Status || 'New'
      const notes = r.notes || r.Notes || ''
      const source = r.source || r.Source || ''

      if (!name) continue

      docs.push({
        name,
        email,
        phone,
        products,
        priority,
        status,
        notes,
        source,
        createdBy: req.userId,
        createdByModel: 'User',
      })
    }

    if (!docs.length) return res.status(400).json({ message: 'No valid rows found in file' })

    const result = await CustomerEnquiry.insertMany(docs, { ordered: false })
    res.json({ message: 'Upload processed', inserted: result.length })
  } catch (err) {
    res.status(500).json({ message: 'Failed to process upload', error: err.message })
  }
})
