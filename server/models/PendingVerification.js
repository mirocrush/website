const mongoose = require('mongoose');

const pendingVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  displayName: { type: String, required: true },
  passwordHash: { type: String, required: true },
  otp:          { type: String, required: true },
  expiresAt:    { type: Date,   required: true },
});

// MongoDB TTL index: automatically removes documents when expiresAt is reached
pendingVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.PendingVerification ||
  mongoose.model('PendingVerification', pendingVerificationSchema);
