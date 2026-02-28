const mongoose = require('mongoose')

const trustedDeviceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        fingerprint: {
            type: String,
            required: true,
        },
        deviceInfo: {
            type: String,
            default: 'Unknown Device',
        },
        trustedAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }, // TTL index — MongoDB auto-deletes expired docs
        },
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
)

// Compound index for fast lookup
trustedDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true })

module.exports = mongoose.model('TrustedDevice', trustedDeviceSchema)
