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
    isVerified: {
      type: Boolean,
      default: false,
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
  },
  {
    timestamps: true,
  }
)

const User = mongoose.model('User', userSchema)
export default User
