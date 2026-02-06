const express = require('express')
const router = express.Router()
const { verifyMerchAccessToken } = require('../middleware/merchAuthMiddleware')
const catalogController = require('../controllers/catalogController')
const multer = require('multer')

// Protect all routes with merch JWT
router.use(verifyMerchAccessToken)

// Upload middleware
const storage = multer.memoryStorage()
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })
const uploadPdf = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true)
    cb(new Error('Only PDF files are allowed'))
  },
})

// Categories
router.post('/categories', catalogController.createCategory)
router.get('/categories', catalogController.listCategories)
router.put('/categories/:id', catalogController.updateCategory)
router.delete('/categories/:id', catalogController.deleteCategory)

// Items (scoped in controller/service by userId/role)
router.post('/items', catalogController.createItem)
router.get('/items', catalogController.listItems)
router.get('/items/:id', catalogController.getItem)
router.put('/items/:id', catalogController.updateItem)
router.delete('/items/:id', catalogController.deleteItem)

// Uploads
router.post('/upload/image', upload.single('image'), catalogController.uploadImage)
router.post('/upload/file', uploadPdf.single('file'), catalogController.uploadFile)

module.exports = router
