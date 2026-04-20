const mongoose = require('mongoose');

const editRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId },
    requesterName: { type: String, default: '' },
    changes: { type: Object, default: {} },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const schema = new mongoose.Schema(
  {
    creatorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',          required: true },
    accountId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloAccount', default: null }, // legacy, kept for migration
    accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReveloAccount' }],
    creatorName: { type: String, default: '' },
    jobName: { type: String, required: true },
    jobMaxDuration: { type: Number },
    jobMaxPayableTime: { type: Number },
    jobExpectedTime: { type: Number },
    hourlyRate: { type: Number },
    jobDescription: { type: String, default: '' },
    startDate: { type: Date },
    leaders: [{ type: String }],
    assets: [{
      name:       { type: String, default: '' },
      url:        { type: String, default: '' },
      size:       { type: Number, default: 0 },
      mimetype:   { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    term: { type: String, enum: ['short', 'long'] },
    learningCurve: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
    editRequests: [editRequestSchema],
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

module.exports = mongoose.models.ReveloJob || mongoose.model('ReveloJob', schema);
