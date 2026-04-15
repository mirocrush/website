const mongoose = require('mongoose');
const { Schema } = mongoose;

const reactionUserSchema = new Schema(
  { userId: Schema.Types.ObjectId, userName: String },
  { _id: false }
);

const emojiSchema = new Schema(
  { emoji: String, users: [reactionUserSchema] },
  { _id: false }
);

const fileSchema = new Schema(
  {
    name:       { type: String, default: '' },
    url:        { type: String, default: '' },
    size:       { type: Number, default: 0 },
    mimetype:   { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const schema = new Schema(
  {
    jobId:    { type: Schema.Types.ObjectId, ref: 'ReveloJob', required: true },
    userId:   { type: Schema.Types.ObjectId, ref: 'User',      required: true },
    userName: { type: String, default: '' },
    content:  { type: String, default: '' }, // HTML from Quill
    files:    [fileSchema],
    parentId: { type: Schema.Types.ObjectId, ref: 'ReveloForumMessage', default: null },
    thumbUp:   [reactionUserSchema],
    thumbDown: [reactionUserSchema],
    emojis:   [emojiSchema],
  },
  { timestamps: true }
);

schema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports =
  mongoose.models.ReveloForumMessage ||
  mongoose.model('ReveloForumMessage', schema);
