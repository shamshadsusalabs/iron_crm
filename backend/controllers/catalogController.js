const catalogService = require('../services/catalogService')

// Helper to get user and role from auth (impersonation-aware)
function getAuth(req) {
  const adminHeaderId = req.headers['x-admin-id']
  const userHeaderId = req.headers['x-user-id']
  const bodyId = req.body?.adminId || req.body?.userId
  const queryId = req.query?.userId
  // Prefer explicit header role (impersonation) over middleware-injected req.role
  const explicitRole = req.headers['x-role'] || req.role || req.query?.role

  let role = explicitRole
  let userId = null

  if (role === 'merch') {
    // Impersonation or merch: prefer x-user-id
    userId = userHeaderId || req.userId || bodyId || queryId || null
  } else if (role === 'admin') {
    // Admin-only context
    userId = adminHeaderId || req.userId || bodyId || queryId || null
  } else {
    // No explicit role: infer
    userId = userHeaderId || adminHeaderId || req.userId || bodyId || queryId || null
    role = adminHeaderId && !userHeaderId ? 'admin' : (userId ? 'merch' : null)
  }
  return { userId, role }
}

// Categories
async function createCategory(req, res) {
  try {
    const { userId } = getAuth(req)
    const cat = await catalogService.createCategory(userId, req.body)
    res.json({ success: true, data: cat })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function listCategories(req, res) {
  try {
    const { userId } = getAuth(req)
    const cats = await catalogService.getCategories(userId)
    res.json({ success: true, data: cats })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function updateCategory(req, res) {
  try {
    const { userId } = getAuth(req)
    const cat = await catalogService.updateCategory(userId, req.params.id, req.body)
    res.json({ success: true, data: cat })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function deleteCategory(req, res) {
  try {
    const { userId } = getAuth(req)
    const result = await catalogService.deleteCategory(userId, req.params.id)
    res.json({ success: true, ...result })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

// Items
async function createItem(req, res) {
  try {
    const { userId: authUserId, role } = getAuth(req)
    const actualUserId = req.userId || authUserId
    // Resolve 'self' from client to actual req userId
    const body = { ...req.body }
    if (body.userId === 'self' || !body.userId) body.userId = actualUserId
    if (body.createdBy === 'self' || !body.createdBy) body.createdBy = actualUserId

    const payload = {
      ...body,
      createdBy: body.createdBy,
      createdByRole: role,
      userId: body.userId, // keep ownership scope
    }
    // For merch-created items, make them active immediately (no approval step)
    if (role === 'merch') {
      payload.status = req.body.status || 'active'
      payload.approvedBy = null
      payload.approvedAt = null
    } else if (role === 'admin') {
      payload.status = req.body.status || 'active'
      if (payload.status === 'active') {
        payload.approvedBy = actualUserId
        payload.approvedAt = new Date()
      }
    }
    const item = await catalogService.createItem(actualUserId, payload)
    res.json({ success: true, data: item })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function listItems(req, res) {
  try {
    const { userId, role } = getAuth(req)
    const { page, limit, search, categoryId, status } = req.query
    // Strict guard: if x-user-id (or resolved userId) exists, always scope by user
    const headerUserId = req.headers['x-user-id']
    const effectiveUserId = (headerUserId === 'self') ? userId : (headerUserId || userId)
    const isUserScoped = !!effectiveUserId

    const result = isUserScoped
      ? await catalogService.getItems(effectiveUserId, { page, limit, search, categoryId, status })
      : await catalogService.getAllItems({ page, limit, search, categoryId, status })
    res.json({ success: true, ...result })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function getItem(req, res) {
  try {
    const { userId } = getAuth(req)
    const item = await catalogService.getItemById(userId, req.params.id)
    res.json({ success: true, data: item })
  } catch (e) {
    res.status(404).json({ success: false, message: e.message })
  }
}

async function updateItem(req, res) {
  try {
    const { userId } = getAuth(req)
    const item = await catalogService.updateItem(userId, req.params.id, req.body)
    res.json({ success: true, data: item })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

async function deleteItem(req, res) {
  try {
    const { userId } = getAuth(req)
    const result = await catalogService.deleteItem(userId, req.params.id)
    res.json({ success: true, ...result })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

// Admin: list all pending catalog items (across users)
async function listPendingForAdmin(req, res) {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' })
    }
    const CatalogItem = require('../models/catalog/CatalogItem')
    // Include creator name/email without changing schema by using aggregation
    const items = await CatalogItem.aggregate([
      { $match: { status: 'pending' } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users', // collection name for User model
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          createdByUser: {
            name: '$creator.name',
            email: '$creator.email',
          },
        },
      },
      { $project: { creator: 0 } },
    ])
    return res.json({ success: true, data: items })
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message })
  }
}

// Admin: approve a catalog item
async function approveItem(req, res) {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' })
    }
    const id = req.params.id
    const CatalogItem = require('../models/catalog/CatalogItem')
    const updated = await CatalogItem.findByIdAndUpdate(
      id,
      { status: 'active', approvedBy: req.userId, approvedAt: new Date() },
      { new: true }
    )
    if (!updated) return res.status(404).json({ success: false, message: 'Item not found' })
    return res.json({ success: true, message: 'Item approved', data: updated })
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message })
  }
}

// Uploads
async function uploadImage(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No image file provided' })
    }
    const uploaded = await catalogService.uploadImage(req.file.buffer)
    res.json({ success: true, data: uploaded })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

// Upload document (PDF or other raw files)
async function uploadFile(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file provided' })
    }
    const uploaded = await catalogService.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype)
    res.json({ success: true, data: uploaded })
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

module.exports = {
  // categories
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  // items
  createItem,
  listItems,
  getItem,
  updateItem,
  deleteItem,
  listPendingForAdmin,
  approveItem,
  // uploads
  uploadImage,
  uploadFile,
}
