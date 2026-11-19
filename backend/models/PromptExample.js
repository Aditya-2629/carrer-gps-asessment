import mongoose from 'mongoose'

const promptExampleSchema = new mongoose.Schema(
  {
    roleKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    sectionType: {
      type: String,
      required: true,
      enum: ['bullet_rewrite', 'linkedin_headline', 'linkedin_about'],
      index: true,
    },
    anonymizedBefore: {
      type: String,
      default: '',
    },
    anonymizedAfter: {
      type: String,
      required: true,
    },
    upVotes: {
      type: Number,
      default: 1,
      index: true,
    },
    downVotes: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 1,
      index: true,
    },
    lastVotedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

promptExampleSchema.pre('save', function (next) {
  this.score = (this.upVotes || 0) - (this.downVotes || 0)
  if (typeof next === 'function') next()
})

promptExampleSchema.index({ roleKey: 1, sectionType: 1, score: -1, upVotes: -1 })

const PromptExample =
  mongoose.models.PromptExample ||
  mongoose.model('PromptExample', promptExampleSchema)

export default PromptExample
