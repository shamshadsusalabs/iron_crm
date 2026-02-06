const mongoose = require('mongoose')

const CatalogItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Creator (Admin or Merch)
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByRole: { type: String, enum: ['admin', 'merch'], required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number },
    images: [
      {
        publicId: { type: String },
        url: { type: String, required: true },
        width: { type: Number },
        height: { type: Number },
        format: { type: String },
      },
    ],
    files: [
      {
        publicId: { type: String },
        url: { type: String, required: true },
        bytes: { type: Number },
        format: { type: String },
        resourceType: { type: String, enum: ['raw', 'image', 'video'], default: 'raw' },
        pages: { type: Number }, // for PDFs
        originalFilename: { type: String },
        mimeType: { type: String },
      },
    ],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CatalogCategory' }],
    tags: [{ type: String }],
    status: { type: String, enum: ['pending', 'active', 'archived'], default: 'active' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CatalogItem', CatalogItemSchema)
