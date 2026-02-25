const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema({
  themeId:         { type: String, required: true, unique: true },
  name:            { type: String, required: true },
  description:     { type: String, default: '' },
  previewImageUrl: { type: String, default: '' },
  isActive:        { type: Boolean, default: true },
  isPremium:       { type: Boolean, default: false },
}, { timestamps: true });

themeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Theme || mongoose.model('Theme', themeSchema);
