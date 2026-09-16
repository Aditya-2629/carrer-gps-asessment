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
            className="quiz-card p-4 sm:p-5 flex items-center gap-3.5 no-underline group hover:border-[var(--primary)] hover:shadow-md transition-all"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)' }}
            >
              <IconComponent size={24} />
            </div>
            <div className="min-w-0">
              <p
                className="font-bold text-base truncate text-[var(--text-primary)]"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                {tool.name}
              </p>
              <p className="text-xs sm:text-sm truncate text-[var(--text-muted)] font-medium mt-0.5">
                {tool.category}
              </p>
            </div>
            <ArrowUpRight
              size={16}
              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--emerald)]"
            />
          </a>
        )
      })}
    </div>
  )
}

