'use client'

import clsx from 'clsx'
import { useFormStatus } from 'react-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100'

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(fieldClass, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(fieldClass, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(fieldClass, props.className)} />
}

export function SubmitButton({
  children,
  pendingText = 'Aguarde…',
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; variant?: 'primary' | 'secondary' | 'danger' }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
    >
      {pending ? pendingText : children}
    </button>
  )
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | undefined }) {
  if (!state?.error && !state?.success) return null
  return (
    <p
      role={state.error ? 'alert' : 'status'}
      className={clsx(
        'rounded-md px-3 py-2 text-sm',
        state.error ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-800'
      )}
    >
      {state.error ?? state.success}
    </p>
  )
}
