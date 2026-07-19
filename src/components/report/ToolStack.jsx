import { Target, ChartBar, Briefcase, Envelope, Microphone, Coins, ArrowUpRight, Wrench } from '@phosphor-icons/react'

const TOOL_ICON_MAP = {
  '🎯': Target,
  '📊': ChartBar,
  '💼': Briefcase,
  '📧': Envelope,
  '🎤': Microphone,
  '💰': Coins,
}

export default function ToolStack({ tools }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {tools.map((tool) => {
        const IconComponent = TOOL_ICON_MAP[tool.icon] || Wrench
        return (
          <a
            key={tool.name}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            id={`tool-${tool.name.toLowerCase().replace(/\s+/g, '-')}`}
            className="glass glass-hover p-4 rounded-2xl flex items-center gap-3 no-underline group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
            >
              <IconComponent size={20} />
            </div>
            <div className="min-w-0">
              <p
                className="font-semibold text-sm truncate text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {tool.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {tool.category}
              </p>
            </div>
            <ArrowUpRight
              size={14}
              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500"
            />
          </a>
        )
      })}
    </div>
  )
}

