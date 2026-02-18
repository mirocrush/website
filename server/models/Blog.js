const mongoose = require('mongoose');

// Metadata stored for every uploaded file
const fileMetaSchema = new mongoose.Schema(
  {
    bucket:   { type: String, required: true },
    path:     { type: String, required: true },
    url:      { type: String, default: null }, // public URL (images only)
    mimeType: { type: String, required: true },
    size:     { type: Number, default: 0 },    // file size in bytes
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    author:  { type: String, required: true, trim: true },
    tags:    [{ type: String, trim: true }],
    images:  { type: [fileMetaSchema], default: [] }, // public, stored with url
    pdfs:    { type: [fileMetaSchema], default: [] }, // private, stored with path only
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
