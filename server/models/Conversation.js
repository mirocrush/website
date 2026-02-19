const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type:     { type: String, enum: ['dm', 'channel'], required: true },
    serverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Server',  default: null },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    // For DMs: sorted concatenation of two user ObjectId strings
    dmKey:    { type: String },
    lastMessageId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ dmKey: 1 },                       { unique: true, sparse: true });
conversationSchema.index({ channelId: 1 },                   { unique: true, sparse: true });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
