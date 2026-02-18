const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slug:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:    { type: String, required: true, trim: true },
    title:   { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

portfolioSchema.index({ userId: 1 });

portfolioSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);
