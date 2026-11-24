import { z } from "zod";
import { isUploadcareImageUrl, normalizeUploadcareImageUrl } from "./security";

// Shared Schemas
export const emailSchema = z.string().trim().email("Invalid email address").max(100);
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(100);
export const nameSchema = z.string().trim().min(2, "Name must be at least 2 characters").max(60);

export const turnstileTokenSchema = z.string().nullable().optional();

export const USER_ROLES = ["CONTRIBUTOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;
export const roleSchema = z.enum(USER_ROLES);

// Registration payload
export const registerSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    turnstileToken: turnstileTokenSchema,
});

// Edit Suggestion Payload
export const suggestSchema = z.object({
    officeId: z.string().trim().min(1, "Office ID is required").max(64),
    type: z.enum(["EDIT", "REMOVAL"]).default("EDIT"),
    name: z.string().trim().min(2, "Office name is required").max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    reason: z.string().trim().max(500).optional(),

    // Auth info (Optional if logged in)
    submitterName: nameSchema.optional(),
    submitterEmail: emailSchema.optional(),
    submitterPassword: passwordSchema.optional(),
    turnstileToken: turnstileTokenSchema,

    // Dynamic fields
    newFieldName: z.string().trim().max(50).optional(),
    newFieldValue: z.string().trim().max(255).optional(),
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix

// Add Post Office Request Payload
export const suggestAddSchema = z.object({
    type: z.literal("ADD"),
    name: z.string().trim().min(2, "Office name must be at least 2 characters").max(100),
    postalCode: z.string().trim().min(2, "Postal code is required").max(20),
    reason: z.string().trim().max(500).optional(),

    // Auth info (Optional if logged in)
    submitterName: nameSchema.optional(),
    submitterEmail: emailSchema.optional(),
    submitterPassword: passwordSchema.optional(),
    turnstileToken: turnstileTokenSchema,
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix

// Create Office Payload (Admin)
export const customOfficeFieldSchema = z.object({
    name: z.string().trim().min(1, "Field name is required").max(60),
    value: z.string().trim().min(1, "Field value is required").max(300),
});

export const createOfficeSchema = z.object({
    name: z.string().trim().min(2, "Office name must be at least 2 characters").max(100),
    postalCode: z.string().trim().min(2, "Postal code is required").max(20),
    operatingHours: z.string().trim().max(200).nullable().optional(),
    services: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    rmsc: z.string().trim().max(120).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    customFields: z.array(customOfficeFieldSchema).max(60).optional(),
}).passthrough(); // Allow dynamic field_* keys through; API routes filter by prefix

// Update Office Payload (Admin)
export const updateOfficeSchema = z.object({
    name: z.string().trim().min(2, "Office name must be at least 2 characters").max(100),
    postalCode: z.string().trim().min(1, "Postal code is required").max(20),
    operatingHours: z.string().trim().max(200).nullable().optional(),
    services: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    rmsc: z.string().trim().max(120).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    customFields: z.array(customOfficeFieldSchema).max(60).optional(),
    newFieldName: z.string().trim().max(50).optional(),
    newFieldValue: z.string().trim().max(255).optional(),
    controllingOfficeId: z.string().trim().max(64).nullable().optional(),
    controlledOfficesIds: z.array(z.string().trim().min(1).max(64)).max(500).optional(),
}).passthrough();

// Blog & News Studio Payloads
export const blogCategorySchema = z.enum(["NEWS", "ALERT", "TARIFF", "GUIDE"]).default("GUIDE");

const optionalCoverImageSchema = z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .optional()
    .refine(
        (val) => !val || isUploadcareImageUrl(val),
        "Cover photo must be uploaded via Uploadcare"
    )
    .transform((val) => {
        if (val === undefined) return undefined;
        return val ? normalizeUploadcareImageUrl(val) : null;
    });

const optionalSourceUrlSchema = z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .optional()
    .refine((val) => {
        if (!val) return true;
        try {
            return new URL(val).protocol === "https:";
        } catch {
            return false;
        }
    }, "Official source URL must start with https://")
    .transform((val) => {
        if (val === undefined) return undefined;
        return val && val.length > 0 ? val : null;
    });

export const blogPostInputSchema = z.object({
    title: z.string().trim().min(3, "Headline must be at least 3 characters").max(200),
    slug: z.string().trim().min(2, "URL slug is required").max(160),
    excerpt: z.string().trim().max(400).optional().default(""),
    contentHtml: z.string().min(1, "Article content is required"),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
    published: z.boolean().optional().default(true),
    category: blogCategorySchema,
    coverImage: optionalCoverImageSchema,
    coverCaption: z.string().trim().max(240).nullable().optional(),
    featured: z.boolean().optional().default(false),
    sourceUrl: optionalSourceUrlSchema,
    author: z.string().trim().min(1).max(80).optional(),
});

// Admin Bulk Operations Payload
export const adminBulkSchema = z.object({
    officeIds: z.array(z.string().trim().min(1).max(64)).min(1, "No offices selected").max(200),
    action: z.enum(["delete", "add_service", "remove_service"]),
    serviceQuery: z.string().trim().min(1).max(80).optional(),
});

// Admin User Management Payloads
export const adminCreateUserSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
});

export const adminUpdateRoleSchema = z.object({
    role: roleSchema,
});

// Public Review Payload
export const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().min(10, "Review must be at least 10 characters").max(1000),
    authorName: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
    postOfficeId: z.string().trim().min(1).max(64),
    turnstileToken: turnstileTokenSchema,
});

// Community Photo Upload Payload
export const photoUploadSchema = z.object({
    url: z
        .string()
        .trim()
        .min(1, "URL is required")
        .max(2048)
        .refine(isUploadcareImageUrl, "Photo must be uploaded through the official Lanka Post uploader")
        .transform(normalizeUploadcareImageUrl),
    caption: z.string().trim().max(200).optional().default(""),
    turnstileToken: turnstileTokenSchema,
});

// 6-digit TOTP token validation
export const totpTokenSchema = z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be 6 digits");
