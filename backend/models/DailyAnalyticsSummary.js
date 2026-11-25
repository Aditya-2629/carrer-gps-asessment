import mongoose from 'mongoose'

const dailyAnalyticsSummarySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    totalVisitors: { type: Number, default: 0 },
    stepDropoffs: { type: mongoose.Schema.Types.Mixed, default: {} },
    completedReports: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const DailyAnalyticsSummary = mongoose.model('DailyAnalyticsSummary', dailyAnalyticsSummarySchema)
export default DailyAnalyticsSummary
