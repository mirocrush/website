const mongoose = require('mongoose');

const savedRepoSchema = new mongoose.Schema(
  {
    posterId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fullName:    { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    htmlUrl:     { type: String, default: '', trim: true },
    language:    { type: String, required: true, trim: true },
    stars:       { type: Number, default: 0 },
    sizeMb:      { type: Number, default: 0 },
    defaultBranch: { type: String, default: 'main', trim: true },
    updatedAt:   { type: String, default: '' },
    smartScore:  { type: Number, default: 0 },
    checks: {
      hasTests:     { type: Boolean, default: false },
      hasReadme:    { type: Boolean, default: false },
      hasPkg:       { type: Boolean, default: false },
      hasCi:        { type: Boolean, default: false },
      hasLinter:    { type: Boolean, default: false },
      hasFormatter: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

savedRepoSchema.index({ posterId: 1 });
savedRepoSchema.index({ posterId: 1, fullName: 1 }, { unique: true });

savedRepoSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.SavedRepo || mongoose.model('SavedRepo', savedRepoSchema);
