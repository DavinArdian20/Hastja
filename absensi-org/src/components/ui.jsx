import React from 'react'

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-[#2C2C2C] bg-[#121212] px-3 py-2 text-white placeholder-gray-500 focus:border-[#E2A053] focus:outline-none focus:ring-1 focus:ring-[#E2A053] ${className}`}
      {...props}
    />
  )
}

export function Btn({ children, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
  const variants = {
    primary: 'bg-[#E2A053] text-gray-950 font-bold hover:bg-[#d49142]',
    secondary: 'bg-[#1E1E1E] text-gray-300 hover:bg-[#2C2C2C] border border-[#2C2C2C]',
    danger: 'bg-[#8A3931] text-white hover:bg-[#722e27]',
  }
  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Msg({ type = 'info', children }) {
  const styles = {
    error: 'bg-[#8A3931]/20 border-[#8A3931] text-red-300',
    success: 'bg-green-950/40 border-green-700 text-green-300',
    info: 'bg-[#2F4879]/30 border-[#2F4879] text-blue-200',
  }
  return (
    <div className={`rounded-lg border p-3 text-sm font-medium ${styles[type] || styles.info}`}>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[#2C2C2C] bg-[#1E1E1E] p-6 text-white shadow-lg ${className}`}>
      {children}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex space-x-1 rounded-xl bg-[#121212] p-1 border border-[#2C2C2C]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'bg-[#E2A053] text-gray-950 font-bold shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function fmt(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}