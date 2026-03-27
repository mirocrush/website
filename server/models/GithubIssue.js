const mongoose = require('mongoose');

const githubIssueSchema = new mongoose.Schema(
  {
    repoName:     { type: String, required: true, trim: true },
    issueLink:    { type: String, required: true, trim: true },
    issueTitle:   { type: String, required: true, trim: true },
    prLink:       { type: String, default: null, trim: true },
    filesChanged: { type: [String], default: [] },
    baseSha:      { type: String, required: true, trim: true },
    posterId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shared:       { type: Boolean, default: false },
    taken:        { type: Boolean, default: false },
    repoCategory: {
      type: String,
      enum: ['Python', 'JavaScript', 'TypeScript'],
      required: true,
    },
  },
  { timestamps: true }
);

githubIssueSchema.index({ posterId: 1 });
githubIssueSchema.index({ shared: 1 });
githubIssueSchema.index({ repoCategory: 1 });

githubIssueSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.GithubIssue || mongoose.model('GithubIssue', githubIssueSchema);
