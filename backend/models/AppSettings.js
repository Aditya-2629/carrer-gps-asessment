import mongoose from 'mongoose'

export const DEFAULT_MESSAGE_TEMPLATES = [
  {
    key: 'ghost_nudge',
    label: 'Ghost Drop-off Nudge',
    channel: 'whatsapp',
    subject: '',
    body: 'Hi {{name}}, saw you started your Career GPS check for {{role}}. Need a hand finishing your ATS diagnosis? Takes 60 seconds and unlocks your gap breakdown.',
  },
  {
    key: 'call_reminder',
    label: 'Strategy Call Reminder',
    channel: 'whatsapp',
    subject: '',
    body: 'Hi {{name}}, looking forward to our 1:1 Career GPS strategy call for {{role}}! Feel free to review your preview before we hop on: {{reportUrl}}',
  },
  {
    key: 'unlocked_delivery',
    label: 'Unlocked Report & ATS Resume Delivery',
    channel: 'email',
    subject: 'Your Unlocked Career GPS Report & Updated ATS Resume ({{role}})',
    body: 'Hi {{name}},\n\nYour full Career GPS Report (Score: {{score}}/100) for {{role}} is now unlocked! View your interactive roadmap here: {{reportUrl}}\n\nWe have also attached your updated ATS-optimized .docx resume.',
  },
  {
    key: 'post_call_followup',
    label: 'Post-Call Follow-up',
    channel: 'whatsapp',
    subject: '',
    body: 'Hi {{name}}, great speaking with you today! Here is your unlocked Career GPS report ({{score}}/100) for {{role}}: {{reportUrl}} — let me know once you review the action plan.',
  },
]

const messageTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['whatsapp', 'email'], default: 'whatsapp' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  { _id: false }
)

const socialLinkItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    url: { type: String, default: '', trim: true },
    iconType: {
      type: String,
      enum: ['linkedin', 'instagram', 'youtube', 'website', 'x', 'custom'],
      default: 'website',
    },
    customLogoUrl: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
)

export const DEFAULT_SOCIAL_LINKS_CONFIG = {
  enabled: false,
  communityEnabled: false,
  communityLabel: 'Join Our Community',
  communityUrl: '',
  items: [
    { key: 'linkedin', label: 'LinkedIn', url: '', iconType: 'linkedin', customLogoUrl: '', enabled: false },
    { key: 'instagram', label: 'Instagram', url: '', iconType: 'instagram', customLogoUrl: '', enabled: false },
    { key: 'youtube', label: 'YouTube', url: '', iconType: 'youtube', customLogoUrl: '', enabled: false },
    { key: 'website', label: 'Website', url: '', iconType: 'website', customLogoUrl: '', enabled: false },
  ],
}

export function normalizeSocialLinksConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const rawItems = Array.isArray(src.items) && src.items.length > 0 ? src.items : DEFAULT_SOCIAL_LINKS_CONFIG.items
  const items = rawItems.map((item, idx) => ({
    key: String(item?.key || `social_${idx}`).trim().slice(0, 40),
    label: String(item?.label || 'Link').trim().slice(0, 60),
    url: String(item?.url || '').trim().slice(0, 500),
    iconType: ['linkedin', 'instagram', 'youtube', 'website', 'x', 'custom'].includes(item?.iconType)
      ? item.iconType
      : 'website',
    customLogoUrl: String(item?.customLogoUrl || '').trim().slice(0, 2000),
    enabled: Boolean(item?.enabled),
  }))
  return {
    enabled: Boolean(src.enabled),
    communityEnabled: Boolean(src.communityEnabled),
    communityLabel: String(src.communityLabel || 'Join Our Community').trim().slice(0, 80) || 'Join Our Community',
    communityUrl: String(src.communityUrl || '').trim().slice(0, 500),
    items,
  }
}

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    teaserModeEnabled: { type: Boolean, default: false },
    teaserVisiblePercent: { type: Number, default: 50 },
    callBookingUrl: {
      type: String,
      default: 'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe',
    },
    whatsappCtaNumber: { type: String, default: '' },
    ctaHeadline: {
      type: String,
      default: '50% Preview — Unlock Your Complete Career GPS Report & Updated ATS Resume',
    },
    ctaSubtext: {
      type: String,
      default: 'Book your free 15-min strategy call or message us on WhatsApp to unlock all bullet rewrites, missing keywords, LinkedIn positioning & your updated ATS resume.',
    },
    ctaButtonLabel: {
      type: String,
      default: 'Book Free 1:1 Strategy Call',
    },
    communityUrl: {
      type: String,
      default: 'https://www.linkedin.com/company/crafture',
    },
    socialLinks: {
      linkedin: { type: String, default: 'https://www.linkedin.com/company/crafture' },
      instagram: { type: String, default: 'https://www.instagram.com/crafture.ai' },
      youtube: { type: String, default: 'https://www.youtube.com/@crafture' },
      website: { type: String, default: 'https://crafture.in' },
    },
    socialLinksConfig: {
      enabled: { type: Boolean, default: false },
      communityEnabled: { type: Boolean, default: false },
      communityLabel: { type: String, default: 'Join Our Community' },
      communityUrl: { type: String, default: '' },
      items: {
        type: [socialLinkItemSchema],
        default: () => DEFAULT_SOCIAL_LINKS_CONFIG.items,
      },
    },
    aiPaused: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: 'AI Career GPS analysis is temporarily paused for maintenance. Please check back shortly.',
    },
    messageTemplates: {
      type: [messageTemplateSchema],
      default: () => DEFAULT_MESSAGE_TEMPLATES,
    },
    modelOverrides: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    apiKeys: {
      openrouter: { type: [String], default: [] },
      groq: { type: [String], default: [] },
      gemini: { type: [String], default: [] },
      apify: { type: [String], default: [] },
    },
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
