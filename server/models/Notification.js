const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'transfer_sent',     // someone sent you a transfer request
        'prep_started',      // your issue entered 'progress' (preparation started)
        'prep_initialized',  // your issue is ready for interaction
        'prep_failed',       // preparation failed
        'interact_started',  // interaction started on your issue
        'interact_done',     // interaction complete
        'submitted',         // issue submitted
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'GithubIssue', default: null },
    read:    { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
