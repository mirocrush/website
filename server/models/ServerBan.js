const mongoose = require('mongoose');

const serverBanSchema = new mongoose.Schema(
  {
    serverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    bannedUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    bannedByUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    reason:        { type: String, default: '' },
  },
  { timestamps: true }
);

serverBanSchema.index({ serverId: 1, bannedUserId: 1 }, { unique: true });

module.exports = mongoose.models.ServerBan || mongoose.model('ServerBan', serverBanSchema);
