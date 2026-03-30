const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Points to whichever Prompt the user has chosen as their "main" prompt.
    // Can reference own prompts OR another user's shared prompt.
    // null means fall back to own isMain prompt.
    mainPromptRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prompt',
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    // Incremented on every signout → instantly invalidates all old JWTs
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash; // never expose the hash
  },
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
