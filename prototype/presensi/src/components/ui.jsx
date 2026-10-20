export const Card = ({ children, className = '' }) => (
  <div className={`rounded-lg bg-white p-4 ring-1 ring-stone-200 ${className}`}>{children}</div>
)

export const Btn = ({ variant = 'primary', className = '', ...p }) => {
  const v = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800',
    ghost: 'bg-stone-100 text-stone-800 hover:bg-stone-200',
    danger: 'bg-red-700 text-white hover:bg-red-800'
  }[variant]
  return (
    <button
      {...p}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-teal-700 ${v} ${className}`}
    />
  )
}

export const Input = (p) => (
  <input {...p} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-teal-700" />
)

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-stone-300">
    {tabs.map(([k, label]) => (
      <button key={k} onClick={() => onChange(k)}
        className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${value === k ? 'border-b-2 border-teal-700 text-teal-800' : 'text-stone-600'}`}>
        {label}
      </button>
    ))}
  </div>
)

export const Msg = ({ msg }) =>
  msg ? <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{msg.text}</p> : null

export const fmt = (d) =>
  d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
