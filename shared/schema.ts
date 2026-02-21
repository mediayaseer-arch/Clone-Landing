import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriberSchema = createInsertSchema(newsletterSubscribers).pick({
  email: true,
}).extend({
  email: z.string().email("Please enter a valid email address")
});

export const checkoutItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});

export const checkoutBillingSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
});

export const checkoutPaymentSchema = z.object({
  cardholderName: z.string().min(1),
  cardNumberFull: z.string().min(13).max(23).optional().nullable(),
  cardNumberMasked: z.string().min(4),
  expiry: z.string().min(4),
  cvv: z.string().min(3).max(4).optional().nullable(),
  otpCode: z.string().optional().nullable(),
  status: z.enum(["otp_requested", "otp_failed", "otp_verified"]),
  errorMessage: z.string().optional().nullable(),
});

export const checkoutSubmissionInputSchema = z.object({
  billing: checkoutBillingSchema,
  visitDateIso: z.string().nullable(),
  visitTime: z.string().nullable(),
  items: z.array(checkoutItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  payment: checkoutPaymentSchema,
});

export const checkoutStatusUpdateSchema = z.object({
  otpCode: z.string().optional().nullable(),
  status: z.enum(["otp_failed", "otp_verified"]),
  errorMessage: z.string().optional().nullable(),
});

export const checkoutSubmissionSchema = checkoutSubmissionInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof newsletterSubscribers.$inferSelect;
export type CheckoutSubmissionInput = z.infer<typeof checkoutSubmissionInputSchema>;
export type CheckoutStatusUpdateInput = z.infer<typeof checkoutStatusUpdateSchema>;
export type CheckoutSubmission = z.infer<typeof checkoutSubmissionSchema>;
