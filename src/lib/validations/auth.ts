import { z } from 'zod';

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "L'email est requis" })
  .email({ message: "Format d'email invalide" })
  .max(255, { message: "L'email ne peut pas dépasser 255 caractères" });

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  .max(128, { message: "Le mot de passe ne peut pas dépasser 128 caractères" })
  .regex(/[A-Z]/, { message: "Le mot de passe doit contenir au moins une majuscule" })
  .regex(/[a-z]/, { message: "Le mot de passe doit contenir au moins une minuscule" })
  .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre" });

// Name validation schema
export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Ce champ est requis" })
  .max(50, { message: "Ne peut pas dépasser 50 caractères" })
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: "Seules les lettres, espaces, apostrophes et tirets sont autorisés" });

// Sign in validation schema
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Le mot de passe est requis" })
});

// Sign up validation schema
export const signUpSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

// Password reset validation schema
export const passwordResetSchema = z.object({
  email: emailSchema
});

// Export types
export type SignInData = z.infer<typeof signInSchema>;
export type SignUpData = z.infer<typeof signUpSchema>;
export type PasswordResetData = z.infer<typeof passwordResetSchema>;