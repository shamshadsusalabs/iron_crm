const express = require('express')
const multer = require('multer')
const router = express.Router()
const catalogController = require('../controllers/catalogController')
const anyAuth = require('../middleware/anyAuthMiddleware')

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

// Separate uploader with PDF filter
const uploadPdf = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true)
    cb(new Error('Only PDF files are allowed'))
  },
})

// Categories
// Authenticated write operations (admin or merch)
router.post('/categories', anyAuth, catalogController.createCategory)
router.get('/categories', catalogController.listCategories)
router.put('/categories/:id', anyAuth, catalogController.updateCategory)
router.delete('/categories/:id', anyAuth, catalogController.deleteCategory)

// Items
// Authenticated write operations (admin or merch)
router.post('/items', anyAuth, catalogController.createItem)
router.get('/items', catalogController.listItems)
// Admin: list pending catalog items (place before /items/:id)
router.get('/items/pending', anyAuth, catalogController.listPendingForAdmin)
router.get('/items/:id', catalogController.getItem)
router.put('/items/:id', anyAuth, catalogController.updateItem)
router.delete('/items/:id', anyAuth, catalogController.deleteItem)
// Admin: approve catalog item
router.patch('/items/:id/approve', anyAuth, catalogController.approveItem)

// Upload image (admin or merch)
router.post('/upload/image', anyAuth, upload.single('image'), catalogController.uploadImage)

// Upload document (PDF) (admin or merch)
router.post('/upload/file', anyAuth, uploadPdf.single('file'), catalogController.uploadFile)

module.exports = router
