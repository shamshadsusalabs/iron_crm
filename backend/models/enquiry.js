const mongoose = require('mongoose');

const CustomerEnquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    products: [{ type: String, trim: true }],
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    status: { type: String, enum: ['New', 'In Progress', 'Responded', 'Closed'], default: 'New' },
    notes: { type: String, trim: true },
    source: { type: String, trim: true },
    assignedTo: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'createdByModel' },
    createdByModel: { type: String, required: true, enum: ['User', 'Admin'] },
  },
  { timestamps: true }
);

CustomerEnquirySchema.index({ email: 1 });
CustomerEnquirySchema.index({ phone: 1 });
CustomerEnquirySchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerEnquiry', CustomerEnquirySchema);
