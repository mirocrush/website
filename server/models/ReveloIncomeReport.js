const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    attachments: [{
      name:     { type: String, default: '' },
      url:      { type: String, default: '' },
      size:     { type: Number, default: 0 },
      mimetype: { type: String, default: '' },
    }],
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

module.exports = mongoose.models.ReveloIncomeReport || mongoose.model('ReveloIncomeReport', schema);
