const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:   { type: String, required: true, trim: true },
    content: { type: String, required: true },
    isMain:  { type: Boolean, default: false },
    shared:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

promptSchema.index({ userId: 1 });
promptSchema.index({ userId: 1, isMain: 1 });

promptSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Prompt || mongoose.model('Prompt', promptSchema);
