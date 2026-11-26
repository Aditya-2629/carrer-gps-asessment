import mongoose from 'mongoose'

const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    currentPhase: { type: String, default: 'assessment' },
    currentStep: { type: String, default: '1' },
    maxStepReached: { type: Number, default: 0, index: true },
    completed: { type: Boolean, default: false, index: true },
    lastHeartbeatAt: { type: Date, default: Date.now, index: true },
    device: { type: String, default: 'desktop' },
    referrer: { type: String, default: '' },
    attribution: {
      source: { type: String, default: 'direct', index: true },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
      referrer: { type: String, default: '' },
    },
    city: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    abandonedDraft: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      targetRole: { type: String, default: '' },
      resumeFilename: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

// Auto-expire raw visitor sessions after 7 days (604800s) to protect MongoDB 512MB tier
visitorSessionSchema.index({ lastHeartbeatAt: 1 }, { expireAfterSeconds: 604800 })

const VisitorSession = mongoose.model('VisitorSession', visitorSessionSchema)
export default VisitorSession
