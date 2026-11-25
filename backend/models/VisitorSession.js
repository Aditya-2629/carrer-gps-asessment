import mongoose from 'mongoose'

const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    currentPhase: { type: String, default: 'assessment' },
    currentStep: { type: String, default: '1' },
    lastHeartbeatAt: { type: Date, default: Date.now, index: true },
    device: { type: String, default: 'desktop' },
    referrer: { type: String, default: '' },
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

const VisitorSession = mongoose.model('VisitorSession', visitorSessionSchema)
export default VisitorSession
