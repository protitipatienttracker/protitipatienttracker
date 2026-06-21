'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const TIPS = [
  { target: 'Add new patients here', description: 'Use "New Admission" to register a patient into the system.' },
  { target: 'Track renewals', description: '"Renewals Due" shows all upcoming contract renewals and overdue items.' },
  { target: 'Monitor assessments', description: 'Capacity assessments can be scheduled and tracked from the Assessments page.' },
  { target: 'View reports', description: 'Reports & Analytics gives you occupancy data and trends.' },
]

export function OnboardingTooltip() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('onboarding-seen')
    if (!seen) setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem('onboarding-seen', 'true')
  }

  function next() {
    if (step < TIPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <div className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-20 lg:left-72">
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-5 max-w-xs shadow-2xl animate-[slideDown_0.3s_ease]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-[14px] font-semibold">{TIPS[step].target}</p>
            <button onClick={dismiss} className="text-[#8E8E93] shrink-0"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-[13px] text-[#EBEBF5]/70 mb-3">{TIPS[step].description}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TIPS.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-[#007AFF]' : 'bg-white/30'}`} />
              ))}
            </div>
            <button onClick={next} className="text-[13px] font-semibold text-[#007AFF] active:opacity-60">
              {step < TIPS.length - 1 ? 'Next' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
