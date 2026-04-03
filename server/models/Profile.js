const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true, trim: true },
    nationality: { type: String, default: null, trim: true },
    expertEmail: { type: String, default: null, trim: true },
    pictureUrl:  { type: String, default: null, trim: true },
    picturePath: { type: String, default: null, trim: true }, // supabase path for deletion
  },
  { timestamps: true }
);

profileSchema.index({ userId: 1 });

profileSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
