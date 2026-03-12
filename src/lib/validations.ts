import { z } from "zod";

// Shared Schemas
export const emailSchema = z.string().email("Invalid email address").max(100);
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(100);
export const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(60);

export const turnstileTokenSchema = z.string().nullable().optional();

// Registration payload
export const registerSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    turnstileToken: turnstileTokenSchema,
});

// Edit Suggestion Payload
const dynamicFieldSchema = z.record(z.string(), z.string().max(255)).optional();

export const suggestSchema = z.object({
    officeId: z.string().min(1, "Office ID is required"),
    type: z.enum(["EDIT", "REMOVAL"]).default("EDIT"),
    name: z.string().min(2, "Office name is required").max(100).optional(),
    postalCode: z.string().max(20).optional(),
    reason: z.string().max(500).optional(),

    // Auth info (Optional if logged in)
    submitterName: nameSchema.optional(),
    submitterEmail: emailSchema.optional(),
    submitterPassword: passwordSchema.optional(),
    turnstileToken: turnstileTokenSchema,

    // Dynamic fields
    newFieldName: z.string().max(50).optional(),
    newFieldValue: z.string().max(255).optional(),
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix

// Add Post Office Request Payload
export const suggestAddSchema = z.object({
    type: z.literal("ADD"),
    name: z.string().min(2, "Office name must be at least 2 characters").max(100),
    postalCode: z.string().min(2, "Postal code is required").max(20),
    reason: z.string().max(500).optional(),

    // Auth info (Optional if logged in)
    submitterName: nameSchema.optional(),
    submitterEmail: emailSchema.optional(),
    submitterPassword: passwordSchema.optional(),
    turnstileToken: turnstileTokenSchema,
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix

// Create Office Payload (Admin)
export const createOfficeSchema = z.object({
    name: z.string().min(2, "Office name must be at least 2 characters").max(100),
    postalCode: z.string().min(2, "Postal code is required").max(20),
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix
