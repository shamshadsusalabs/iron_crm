const mongoose = require('mongoose')

const CatalogCategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CatalogCategory', CatalogCategorySchema)
