import { useState } from 'react'

const ranges = [[1, 'Last hour'], [24, 'Last 24 hours'], [168, 'Last 7 days'], [720, 'Last 30 days']] as const
const ages = [0.15, 0.6, 2, 5, 12, 22, 48, 100, 200, 500]
const timeLabel = (hours: number) => new Date(Date.now() - hours * 3600000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function TimeRange({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <select className="status-select" aria-label={label} value={value} onChange={event => onChange(Number(event.target.value))}>{ranges.map(([hours, title]) => <option key={hours} value={hours}>{title}</option>)}</select>
}

export function DeviceHistory({ kind, people, name }: { kind: 'graph' | 'people' | 'alarms'; people: number; name: string }) {
  const [range, setRange] = useState(24)
  const [hover, setHover] = useState<number | null>(null)
  const records = ages.map((age, i) => ({ age, battery: 55 + i * 3, signal: -67 - i, current: Math.max(0, people + [0, -2, 1, -3, 2, -4, 4, -1, 3, -2][i]), previous: Math.max(0, people + [-2, 1, -3, 2, -4, 4, -1, 3, -2, 0][i]) })).filter(record => record.age <= range)
  const title = kind === 'graph' ? 'Telemetry history' : kind === 'people' ? 'People count changes' : 'Alarms'
  const chartRecords = [...records].reverse()
  const x = (age: number) => 45 + (1 - age / range) * 605
  const y = (value: number) => 190 - value * 1.6
  const line = chartRecords.map(record => `${x(record.age)},${y(record.battery)}`).join(' ')
  const active = hover === null ? null : chartRecords[hover]
  return <section className={`panel ${kind === 'graph' ? 'telemetry history-chart-panel' : kind === 'people' ? 'people-history' : 'alarms-detail'}`}>
    <div className="panel-head"><div><h2>{title}</h2><p>{kind === 'graph' ? 'Battery (%) · Hover or tap a point for signal details' : kind === 'people' ? 'Recorded only when the detected count changes' : 'Recent alerts from this device'} · Sample data</p></div><TimeRange value={range} onChange={value => { setRange(value); setHover(null) }} label={`${title} time range`}/></div>
    {kind === 'graph' ? <div className="interactive-chart">
      <svg viewBox="0 0 680 235" role="img" aria-label={`Battery telemetry over ${range} hours`}>
        {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="45" x2="650" y1={y(value)} y2={y(value)} className="grid-line"/><text x="30" y={y(value) + 4} textAnchor="end">{value}</text></g>)}
        <polyline points={line} className="chart-line"/>
        {chartRecords.map((record, index) => <circle key={record.age} cx={x(record.age)} cy={y(record.battery)} r="6" tabIndex={0} role="button" aria-label={`${timeLabel(record.age)}, battery ${record.battery}%, signal ${record.signal} dBm`} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} onClick={() => setHover(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setHover(index) }}/>)}
        {[range, range / 2, 0].map(age => <text key={age} x={x(age)} y="224" textAnchor={age === range ? 'start' : age === 0 ? 'end' : 'middle'}>{age === 0 ? 'Now' : timeLabel(age)}</text>)}
      </svg>
      {active && <div className="telemetry-tooltip" role="status"><b>{timeLabel(active.age)}</b><span>Battery: {active.battery}%</span><span>RSSI: {active.signal} dBm</span></div>}
    </div> : kind === 'people' ? <div className="people-table"><div className="table-header"><span>Time</span><span>Previous</span><span>Current</span><span>Change</span></div>{records.filter(record => record.current !== record.previous).map(record => { const change = record.current - record.previous; return <div className="people-row" key={record.age}><span>{timeLabel(record.age)}</span><span>{record.previous} people</span><b>{record.current} people</b><em className={change > 0 ? 'increase' : 'decrease'}>{change > 0 ? '+' : ''}{change}</em></div> })}</div> : <div className="alarm-table"><div className="table-header"><span>Created time</span><span>Device name</span><span>Battery</span><span>Signal</span><span>Status</span></div>{records.map((record, index) => <div className="table-row" key={record.age}><span><b>{['Motion detected', 'Connection unstable', 'Camera connection lost'][index % 3]}</b><small>{timeLabel(record.age)}</small></span><span>{name}</span><span>{record.battery}%</span><span>{record.signal} dBm</span><span><em className={index === 0 ? 'warning' : ''}>{index === 0 ? 'Unacknowledged' : 'Acknowledged'}</em></span></div>)}</div>}
  </section>
}
