const mongoose = require('mongoose');

const serverMemberSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    roles:    { type: [String], default: [] },
    joinedAt: { type: Date, default: Date.now },
  }
);

serverMemberSchema.index({ serverId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.ServerMember || mongoose.model('ServerMember', serverMemberSchema);
