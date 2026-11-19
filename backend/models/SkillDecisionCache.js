import mongoose from 'mongoose'

const skillDecisionCacheSchema = new mongoose.Schema(
  {
    termLower: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    decision: {
      type: String,
      required: true,
      enum: ['VALID_SKILL', 'LOCATION', 'BOILERPLATE', 'GENERIC_NOISE'],
    },
    isSkill: {
      type: Boolean,
      required: true,
      index: true,
    },
    canonical: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
)

const SkillDecisionCache =
  mongoose.models.SkillDecisionCache ||
  mongoose.model('SkillDecisionCache', skillDecisionCacheSchema)

export default SkillDecisionCache
