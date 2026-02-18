const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema(
  {
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'denied'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests between the same pair (in the same direction)
friendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

module.exports =
  mongoose.models.FriendRequest ||
  mongoose.model('FriendRequest', friendRequestSchema);
