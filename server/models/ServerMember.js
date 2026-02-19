const mongoose = require('mongoose');

const serverMemberSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    roles:    { type: [String], default: [] },
    muted:    { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  }
);

serverMemberSchema.index({ serverId: 1, userId: 1 }, { unique: true });
serverMemberSchema.index({ serverId: 1 });

module.exports = mongoose.models.ServerMember || mongoose.model('ServerMember', serverMemberSchema);
