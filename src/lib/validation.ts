import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 10
export const PIN_LENGTH = 6

/// Требования к паролю намеренно умеренные: длина важнее экзотических символов,
/// а невыполнимые правила приводят к паролям на стикере под монитором.
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: 'passwordTooShort' })
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'passwordTooWeak',
  })

export const emailSchema = z.email({ message: 'email' }).max(255).toLowerCase().trim()

export const pinSchema = z
  .string()
  .regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), { message: 'pinLength' })

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'required' }),
})

export const pinSignInSchema = z.object({
  pin: pinSchema,
})

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'passwordsDoNotMatch',
    path: ['passwordConfirm'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'required' }),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'passwordsDoNotMatch',
    path: ['passwordConfirm'],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SetPasswordInput = z.infer<typeof setPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
