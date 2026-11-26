import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    reportUnlocked: {
      type: Boolean,
      default: false,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    callBooked: {
      type: Boolean,
      default: false,
    },
    callBookedAt: {
      type: Date,
      default: null,
    },
    pipelineStage: {
      type: String,
      enum: ['new', 'call_booked', 'follow_up', 'unlocked', 'converted', 'lost', 'contacted', 'scheduled', 'placed'],
      default: 'new',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    followUpDate: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    totalCostUsd: {
      type: Number,
      default: 0,
    },
    totalCostInr: {
      type: Number,
      default: 0,
    },
    costBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attribution: {
      source: { type: String, default: 'direct', index: true },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
      referrer: { type: String, default: '' },
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    semanticProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resumeData: {
      type: Buffer,
      default: null,
    },
    resumeName: {
      type: String,
      default: null,
    },
    resumeR2Key: {
      type: String,
      default: null,
    },
    resumeJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedinUrl: {
      type: String,
      default: null,
    },
    linkedinData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedinActivityData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedinActivitySignals: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedin_agent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedinAgent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resume_agent: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

const User = mongoose.model('User', userSchema)
export default User
