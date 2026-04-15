const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    nationality: { type: String, default: '' },
    createdDate: { type: Date, default: Date.now },
    proxyDetail: {
      host: { type: String, default: '' },
      port: { type: String, default: '' },
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      protocol: { type: String, enum: ['http', 'socks5'], default: 'http' },
    },
    attachedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReveloJob' }],
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

module.exports = mongoose.models.ReveloAccount || mongoose.model('ReveloAccount', schema);
