const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloAccount', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloJob', required: true },
    taskUuid:  { type: String, default: '' },
    duration:  { type: String, default: '' },
    comment:   { type: String, default: '' },
    feedback:  { type: String, default: '' },
    startDate: { type: Date },
    attachments: [{
      name:       { type: String, default: '' },
      url:        { type: String, default: '' },
      size:       { type: Number, default: 0 },
      mimetype:   { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: ['started', 'submitted', 'rejected', 'rejected_redo', 'below_expectation', 'meet_expectation', 'above_expectation'],
      default: 'started',
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
