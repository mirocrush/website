const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloAccount', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloJob', required: true },
    startDate: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

schema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.ReveloTask || mongoose.model('ReveloTask', schema);
