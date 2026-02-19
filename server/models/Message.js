const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    name:     { type: String, required: true },
    mimeType: { type: String, required: true },
    size:     { type: Number, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',         required: true },
    content:          { type: String, default: '' },
    kind:             { type: String, enum: ['text', 'image', 'file', 'deleted'], default: 'text' },
    replyToMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    attachments:      { type: [attachmentSchema], default: [] },
    editedAt:         { type: Date, default: null },
    deletedAt:        { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
