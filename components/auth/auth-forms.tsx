'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormMessage, Input, SubmitButton } from '@/components/ui'
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  updateProfile,
  type FormState,
} from '@/app/auth/actions'

const initial: FormState = {}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState(signIn, initial)
  return (
    <form action={action} className="space-y-4">
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/recuperar-senha" className="text-brand-700 hover:underline">
          Esqueci minha senha
        </Link>
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="text-brand-700 hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  )
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial)
  if (state.success) {
    return <FormMessage state={state} />
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="name" maxLength={120} />
      </Field>
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirme a senha" htmlFor="password_confirm">
        <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Criando conta…">
        Criar conta
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, initial)
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail da conta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Enviando…">
        Enviar link
      </SubmitButton>
    </form>
  )
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial)
  return (
    <form action={action} className="space-y-4">
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="password_confirm">
        <Input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  )
}

export function ProfileForm({ fullName, marketingOptIn }: { fullName: string; marketingOptIn: boolean }) {
  const [state, action] = useActionState(updateProfile, initial)
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={fullName} maxLength={120} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={marketingOptIn}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        <span>Quero receber por e-mail alertas e ofertas do Oferta Certa. Posso cancelar quando quiser.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
    </form>
  )
}
