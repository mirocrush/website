const mongoose = require('mongoose');

const fileMetaSchema = new mongoose.Schema(
  {
    bucket:   { type: String, required: true },
    path:     { type: String, required: true },
    url:      { type: String, default: null },
    mimeType: { type: String, required: true },
    size:     { type: Number, default: 0 },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    userId:      { type: String, required: true },
    username:    { type: String, default: '' },
    displayName: { type: String, default: '' },
    content:     { type: String, required: true, trim: true },
    likes:       { type: [String], default: [] },
  },
  { timestamps: true }
);

const blogSchema = new mongoose.Schema(
  {
    title:    { type: String, required: true, trim: true },
    content:  { type: String, required: true, trim: true },
    author:   { type: String, required: true, trim: true },
    userId:   { type: String, default: null },
    username: { type: String, default: null },
    tags:     [{ type: String, trim: true }],
    images:   { type: [fileMetaSchema], default: [] },
    pdfs:     { type: [fileMetaSchema], default: [] },
    status:   { type: String, enum: ['open', 'solved', 'closed'], default: 'open' },
    comments: { type: [commentSchema], default: [] },
    likes:    { type: [String], default: [] }, // array of userIds
  },
  { timestamps: true }
);

blogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
