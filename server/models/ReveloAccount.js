const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    nationality: { type: String, default: '' },
    createdDate: { type: Date, default: Date.now },

    // Connection type: proxy or remote PC
    connectionType: {
      type: String,
      enum: ['proxy', 'remote_pc'],
      default: 'proxy',
    },

    // Proxy details (used when connectionType === 'proxy')
    proxyDetail: {
      host:     { type: String, default: '' },
      port:     { type: String, default: '' },
      account:  { type: String, default: '' },
      password: { type: String, default: '' },
      protocol: { type: String, enum: ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'], default: 'HTTP' },
    },

    // Remote PC details (used when connectionType === 'remote_pc')
    remotePc: {
      holderName:  { type: String, default: '' },
      nationality: { type: String, default: '' },
    },

    // Payment details
    paymentDetails: {
      idVerified:              { type: Boolean, default: false },
      paymentVerified:         { type: Boolean, default: false },
      bankHoldingStatus:       { type: String, enum: ['', 'citizen_holding', 'holding_myself'], default: '' },
      revenueSharePercentage:  { type: Number, default: 0 },
    },

    // Multi-status badges
    statuses: [{
      type: String,
      enum: ['fresh_new', 'open_jobs', 'approved_tasks', 'payment_attached', 'earned_money', 'suspended'],
    }],

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
