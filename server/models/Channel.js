const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    name:     { type: String, required: true, trim: true, lowercase: true },
    type:     { type: String, enum: ['text'], default: 'text' },
  },
  { timestamps: true }
);

channelSchema.index({ serverId: 1 });

module.exports = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
