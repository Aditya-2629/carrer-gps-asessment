import mongoose from 'mongoose'

const chunkSchema = new mongoose.Schema({
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: [{ type: Number }],
})

const kbDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'doc', 'txt', 'md', 'manual'],
      required: true,
    },
    originalSize: {
      type: Number,
      default: 0,
    },
    rawText: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    chunks: [chunkSchema],
    uploadedBy: {
      type: String,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
)

const KBDocument = mongoose.model('KBDocument', kbDocumentSchema)
export default KBDocument
