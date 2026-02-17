const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    author:  { type: String, required: true, trim: true },
    tags:    [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Map _id → id and strip __v from all JSON responses
blogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

// Prevent model recompilation in serverless hot-reload
module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
