const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const channelSchema = new mongoose.Schema(
  {
    serverId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    name:       { type: String, required: true, trim: true, lowercase: true },
    type:       { type: String, enum: ['text'], default: 'text' },
    channelKey: { type: String, unique: true, default: uuidv4 },
  },
  { timestamps: true }
);

channelSchema.index({ serverId: 1 });

module.exports = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
