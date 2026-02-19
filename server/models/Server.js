const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    iconUrl:     { type: String, default: null },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Server || mongoose.model('Server', serverSchema);
