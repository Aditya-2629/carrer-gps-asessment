const WEEK_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b']

export default function RoadmapTimeline({ weeks }) {
  return (
    <div className="relative pl-12">
      {/* Vertical line */}
      <div className="timeline-line" />

      <div className="flex flex-col gap-8">
        {weeks.map((week, i) => {
          const color = WEEK_COLORS[i % WEEK_COLORS.length]
          return (
            <div key={week.week} className="relative">
              {/* Circle node */}
              <div
                className="absolute -left-12 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold z-10"
                style={{
                  background: `${color}18`,
                  border: `2px solid ${color}`,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color,
                }}
              >
                W{week.week}
              </div>

              <div
                className="glass p-5 rounded-2xl"
                style={{ borderColor: `${color}20` }}
              >
                <h3
                  className="font-bold mb-4 text-base"
                  style={{ fontFamily: 'Space Grotesk, sans-serif', color }}
                >
                  Week {week.week}: {week.title}
                </h3>
                <ul className="space-y-3">
                  {week.tasks.map((task, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      </div>
                      <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {task}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

