const mongoose = require('mongoose');

const conversationMemberSchema = new mongoose.Schema(
  {
    conversationId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User',         required: true },
    lastReadMessageId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastReadAt:         { type: Date, default: null },
    muted:              { type: Boolean, default: false },
    pinned:             { type: Boolean, default: false },
  }
);

conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberSchema.index({ userId: 1 });

module.exports =
  mongoose.models.ConversationMember ||
  mongoose.model('ConversationMember', conversationMemberSchema);
