import mongoose from 'mongoose'

const knowledgeBaseSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    sections: [
      {
        title: { type: String, required: true },
        points: [{ type: String }],
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    lastUpdatedBy: {
      type: String,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
)

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema)
export default KnowledgeBase
