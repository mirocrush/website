const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const serverSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    iconUrl:     { type: String, default: null },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic:    { type: Boolean, default: true },
    inviteKey:   { type: String, unique: true, sparse: true, default: uuidv4 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Server || mongoose.model('Server', serverSchema);
