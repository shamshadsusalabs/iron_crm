const mongoose = require("mongoose")

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    htmlContent: {
      type: String,
      required: false,
    },
    textContent: String,
    // If true and htmlContent is empty, send as text-only email (no HTML fallback)
    forceTextOnly: { type: Boolean, default: false },
    variables: {
      type: [String],
      default: [],
    },
    type: {
      type: String,
      enum: ["initial", "followup1", "followup2", "followup3"],
      default: "initial",
    },
    // Creator (can be Admin or Merchandiser)
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByRole: { type: String, enum: ["admin", "merch"], required: true },
    // Backward compatible field if referenced elsewhere
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    selectedCatalogItemIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CatalogItem" }
    ],
    catalogLayout: {
      type: String,
      enum: ["grid2", "grid3", "list"],
      default: "grid2",
    },
    showPrices: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    approvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Template", templateSchema)
