const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',          required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloAccount', required: true },
    jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ReveloJob',     required: true },
    type:      { type: String, enum: ['submitted', 'approved', 'rejected'],  required: true },
    count:     { type: Number, required: true, min: 1 },
    note:      { type: String, default: '' },
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

module.exports = mongoose.models.ReveloTaskBalance || mongoose.model('ReveloTaskBalance', schema);
