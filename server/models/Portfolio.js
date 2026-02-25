const mongoose = require('mongoose');
const { Schema } = mongoose;

const SocialSchema = new Schema({
  platform: { type: String, enum: ['github','linkedin','twitter','youtube','instagram','other'], required: true },
  url:      { type: String, required: true },
  label:    { type: String, default: '' },
}, { _id: true });

const SkillSchema = new Schema({
  name:     { type: String, required: true },
  category: { type: String, enum: ['frontend','backend','devops','design','other'], default: 'other' },
  level:    { type: String, enum: ['beginner','intermediate','advanced','expert'], default: 'intermediate' },
  order:    { type: Number, default: 0 },
}, { _id: true });

const ExperienceSchema = new Schema({
  company:     { type: String, required: true },
  role:        { type: String, required: true },
  type:        { type: String, enum: ['full-time','part-time','contract','freelance'], default: 'full-time' },
  location:    { type: String, default: '' },
  remote:      { type: Boolean, default: false },
  startDate:   { type: String, required: true },
  endDate:     { type: String, default: '' },
  description: { type: String, default: '' },
  order:       { type: Number, default: 0 },
}, { _id: true });

const EducationSchema = new Schema({
  institution: { type: String, required: true },
  degree:      { type: String, required: true },
  startYear:   { type: Number, required: true },
  endYear:     { type: Number, default: null },
  description: { type: String, default: '' },
  order:       { type: Number, default: 0 },
}, { _id: true });

const ProjectSchema = new Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  tech:        { type: [String], default: [] },
  imageUrl:    { type: String, default: '' },
  demoUrl:     { type: String, default: '' },
  repoUrl:     { type: String, default: '' },
  featured:    { type: Boolean, default: false },
  order:       { type: Number, default: 0 },
}, { _id: true });

const CertificationSchema = new Schema({
  title:         { type: String, required: true },
  issuer:        { type: String, required: true },
  date:          { type: String, default: '' },
  credentialUrl: { type: String, default: '' },
  order:         { type: Number, default: 0 },
}, { _id: true });

const portfolioSchema = new Schema({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  slug:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  themeId: { type: String, default: 'minimal' },

  name:             { type: String, required: true, trim: true },
  title:            { type: String, required: true, trim: true },
  tagline:          { type: String, default: '' },
  bio:              { type: String, default: '' },
  avatarUrl:        { type: String, default: '' },
  location:         { type: String, default: '' },
  availableForWork: { type: Boolean, default: false },

  contact: {
    email:   { type: String, default: '' },
    phone:   { type: String, default: '' },
    website: { type: String, default: '' },
  },

  socials:        { type: [SocialSchema],        default: [] },
  skills:         { type: [SkillSchema],         default: [] },
  experience:     { type: [ExperienceSchema],    default: [] },
  education:      { type: [EducationSchema],     default: [] },
  projects:       { type: [ProjectSchema],       default: [] },
  certifications: { type: [CertificationSchema], default: [] },

  settings: {
    sectionsOrder: { type: [String], default: () => ['skills','experience','projects','education','certifications'] },
    sectionsVisible: {
      skills:         { type: Boolean, default: true },
      experience:     { type: Boolean, default: true },
      projects:       { type: Boolean, default: true },
      education:      { type: Boolean, default: true },
      certifications: { type: Boolean, default: true },
    },
    seoTitle:       { type: String, default: '' },
    seoDescription: { type: String, default: '' },
  },
}, { timestamps: true });

portfolioSchema.index({ userId: 1 });

portfolioSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);
