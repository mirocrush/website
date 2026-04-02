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
    takenStatus:  {
      type: String,
      enum: ['open', 'progress', 'initialized', 'progress_interaction', 'interacted', 'submitted', 'failed'],
      default: 'open',
    },
    lastHeartbeat:     { type: Date,   default: null },
    // Set when PR Preparation marks the issue as 'initialized'
    initialResultDir:  { type: String, default: null, trim: true },
    // Filename of the zip uploaded to the file server after preparation
    uploadFileName:    { type: String, default: null, trim: true },
    // Set when PR Interaction marks the issue as 'interacted'
    taskUuid:          { type: String, default: null, trim: true },
    // Submitted with the interacted API call
    dockerfileContent: { type: String, default: null },
    firstPrompt:       { type: String, default: null },
    repoCategory: {
      type: String,
      enum: ['Python', 'JavaScript', 'TypeScript'],
      required: true,
    },
    pendingTransfer: {
      toUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      toUsername:  { type: String, default: null },
      requestedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

githubIssueSchema.index({ issueLink: 1 }, { unique: true }); // one owner per issue, globally
githubIssueSchema.index({ posterId: 1 });
githubIssueSchema.index({ shared: 1 });
githubIssueSchema.index({ takenStatus: 1 });
githubIssueSchema.index({ lastHeartbeat: 1 });
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
