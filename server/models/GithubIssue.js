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
    // Quality score 0-100 computed by score algorithm
    score:         { type: Number, default: null },
    // How was this issue added to the list
    addedVia: {
      type: String,
      enum: ['manual', 'excel', 'smart_search'],
      default: 'manual',
    },
    // Free-text comment left by client apps or server about unexpected situations
    comment:       { type: String, default: null },
    // Timestamps for workflow state transitions
    startDatetime: { type: Date, default: null }, // set when → progress or progress_interaction
    endDatetime:   { type: Date, default: null }, // set when → initialized or interacted
    // Profile assigned to this issue
    profile:       { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    // Ordering
    pinned:        { type: Boolean, default: false },
    priority:      { type: Number, default: 0 },  // higher = higher priority
  },
  { timestamps: true }
);

githubIssueSchema.index({ issueLink: 1 }, { unique: true }); // one owner per issue, globally
githubIssueSchema.index({ posterId: 1 });
githubIssueSchema.index({ shared: 1 });
githubIssueSchema.index({ takenStatus: 1 });
githubIssueSchema.index({ lastHeartbeat: 1 });
githubIssueSchema.index({ repoCategory: 1 });
githubIssueSchema.index({ pinned: 1, priority: -1, createdAt: 1 });

githubIssueSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.GithubIssue || mongoose.model('GithubIssue', githubIssueSchema);
