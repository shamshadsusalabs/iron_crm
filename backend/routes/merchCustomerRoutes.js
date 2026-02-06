const express = require('express')
const router = express.Router()
const { verifyMerchAccessToken } = require('../middleware/merchAuthMiddleware')
const Customer = require('../models/customer')
const multer = require('multer')
const XLSX = require('xlsx')

// All routes protected by merch JWT
router.use(verifyMerchAccessToken)

// Helper to ensure ownership
async function findOwnCustomer(userId, id) {
  return Customer.findOne({ _id: id, createdBy: userId, createdByModel: 'User' })
}

// List own customers
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, q, status } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const regex = q ? { $regex: q, $options: 'i' } : null
    const search = regex
      ? { $or: [{ name: regex }, { email: regex }, { phone: regex }, { address: regex }] } // removed status from regex search to avoid conflict if both used
      : {}

    const base = { createdBy: req.userId, createdByModel: 'User' }
    const query = { ...base, ...search }

    if (status) {
      query.status = status
    }

    const [items, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('createdBy', 'name email'),
      Customer.countDocuments(query),
    ])
    res.json({ items, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: err.message })
  }
})

// Create new customer owned by this merch user
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address, status, interestedProducts, history, notes } = req.body
    if (!name || !email) return res.status(400).json({ message: 'name and email are required' })

    const exists = await Customer.findOne({ email: String(email).toLowerCase(), createdBy: req.userId })
    if (exists) return res.status(409).json({ message: 'Email already exists' })

    const effectiveStatus = status || 'Warm'
    const interestedArr = Array.isArray(interestedProducts)
      ? interestedProducts
      : typeof interestedProducts === 'string' && interestedProducts.trim()
        ? interestedProducts.split(',').map((s) => s.trim()).filter(Boolean)
        : []

    const historyArr = Array.isArray(history) ? [...history] : []
    historyArr.push({ date: new Date(), action: 'Created', details: `Status: ${effectiveStatus}` })

    const doc = await Customer.create({
      name,
      email: String(email).toLowerCase(),
      phone,
      address,
      status: effectiveStatus,
      interestedProducts: interestedArr,
      history: historyArr,
      notes,
      createdBy: req.userId,
      createdByModel: 'User',
    })
    res.status(201).json(doc)
  } catch (err) {
    res.status(500).json({ message: 'Failed to create customer', error: err.message })
  }
})

// Update own customer
router.put('/:id', async (req, res) => {
  try {
    const prev = await findOwnCustomer(req.userId, req.params.id)
    if (!prev) return res.status(404).json({ message: 'Customer not found' })

    const { name, email, phone, address, status, interestedProducts, history, notes } = req.body
    const update = {}
    if (typeof name !== 'undefined') update.name = name
    if (typeof email !== 'undefined') update.email = String(email).toLowerCase()
    if (typeof phone !== 'undefined') update.phone = phone
    if (typeof address !== 'undefined') update.address = address
    if (typeof status !== 'undefined') update.status = status
    if (typeof interestedProducts !== 'undefined') {
      update.interestedProducts = Array.isArray(interestedProducts)
        ? interestedProducts
        : typeof interestedProducts === 'string' && interestedProducts.trim()
          ? interestedProducts.split(',').map((s) => s.trim()).filter(Boolean)
          : []
    }
    if (typeof history !== 'undefined') update.history = Array.isArray(history) ? history : []
    if (typeof notes !== 'undefined') update.notes = notes

    const updateOps = { $set: update }
    if (typeof status !== 'undefined' && prev.status !== status) {
      updateOps.$push = { history: { date: new Date(), action: 'Status Updated', details: `${prev.status || '-'} → ${status}` } }
    }

    const updated = await Customer.findOneAndUpdate({ _id: req.params.id, createdBy: req.userId }, updateOps, { new: true })
    res.json(updated)
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: 'Email already exists' })
    res.status(500).json({ message: 'Failed to update customer', error: err.message })
  }
})

// Delete own customer
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Customer.findOneAndDelete({ _id: req.params.id, createdBy: req.userId })
    if (!deleted) return res.status(404).json({ message: 'Customer not found' })
    res.json({ message: 'Customer deleted' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message })
  }
})

module.exports = router

// Excel upload for merch user (bulk upsert scoped to owner)
const upload = multer({ storage: multer.memoryStorage() })
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    console.log('📊 Excel Upload Debug - Total rows found:', rows.length)
    console.log('📋 First row keys:', rows.length > 0 ? Object.keys(rows[0]) : 'No rows')

    const docs = []
    for (const r of rows) {
      const name = r.name || r.Name || r.fullname || r.FullName || ''
      const email = (r.email || r.Email || '').toString().toLowerCase()
      if (!name || !email) continue
      const phone = r.phone || r.Phone || ''
      const address = r.address || r.Address || ''
      const status = r.status || r.Status || 'Warm'
      const interested = r.interestedProducts || r.InterestedProducts || r.products || r.Products || r.product || r.Product || r['Interested Products'] || r['interested products'] || ''
      const notes = r.notes || r.Notes || ''

      console.log(`🔍 Processing ${name} (${email}):`)
      console.log('  - Raw interested value:', interested)
      console.log('  - Type:', typeof interested)

      const interestedProducts = Array.isArray(interested)
        ? interested
        : typeof interested === 'string' && interested.trim()
          ? interested.split(',').map((s) => s.trim()).filter(Boolean)
          : []

      console.log('  - Final interestedProducts:', interestedProducts)

      docs.push({ name, email, phone, address, status, interestedProducts, notes })
    }

    if (!docs.length) return res.status(400).json({ message: 'No valid rows found in file' })

    const owner = { createdBy: req.userId, createdByModel: 'User' }
    const ops = docs.map((d) => {
      console.log(`💾 Preparing to save ${d.name}:`, {
        interestedProducts: d.interestedProducts,
        interestedProductsLength: d.interestedProducts?.length
      })
      return {
        updateOne: {
          filter: { email: d.email, ...owner },
          update: {
            $set: { ...d, ...owner },
            $setOnInsert: {
              history: [{ date: new Date(), action: 'Created', details: `Status: ${d.status || 'Warm'}` }],
            },
          },
          upsert: true,
        },
      }
    })

    console.log('🚀 About to execute bulkWrite with', ops.length, 'operations')
    const result = await Customer.bulkWrite(ops, { ordered: false })
    console.log('✅ BulkWrite result:', result)
    res.json({ message: 'Upload processed', result })
  } catch (err) {
    res.status(500).json({ message: 'Failed to process upload', error: err.message })
  }
})
