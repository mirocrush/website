const mongoose = require('mongoose');

const searchSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    isRunning: { type: Boolean, default: false },
    queueItems: {
      type: [
        {
          uid:       { type: String },
          issue:     { type: mongoose.Schema.Types.Mixed },
          score:     { type: Number },
          breakdown: { type: mongoose.Schema.Types.Mixed },
        },
      ],
      default: [],
    },
    imported:   { type: Number, default: 0 },
    log:        { type: [{ text: String, color: String }], default: [] },
    // Search config snapshot (restored on resume)
    keyword:            { type: String, default: '' },
    autoApprove:        { type: Boolean, default: false },
    selectedCategories: { type: [String], default: [] },
  },
  { timestamps: true }
);

searchSessionSchema.index({ userId: 1 }, { unique: true });

module.exports =
  mongoose.models.SearchSession ||
  mongoose.model('SearchSession', searchSessionSchema);
