import mongoose from 'mongoose'

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    teaserModeEnabled: { type: Boolean, default: false },
    callBookingUrl: {
      type: String,
      default: 'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe',
    },
    whatsappCtaNumber: { type: String, default: '' },
  },
  { timestamps: true }
)

const AppSettings = mongoose.model('AppSettings', appSettingsSchema)

/**
 * Returns the singleton global AppSettings document, creating it with defaults if missing.
 */
export async function getGlobalSettings() {
  let doc = await AppSettings.findOne({ key: 'global' }).lean()
  if (!doc) {
    const created = await AppSettings.create({ key: 'global' })
    doc = created.toObject()
  }
  return doc
}

export default AppSettings
