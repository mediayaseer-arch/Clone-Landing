import { z } from 'zod';
import {
  checkoutStatusUpdateSchema,
  checkoutSubmissionInputSchema,
  checkoutSubmissionSchema,
  insertSubscriberSchema,
  newsletterSubscribers,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  newsletter: {
    subscribe: {
      method: 'POST' as const,
      path: '/api/newsletter/subscribe' as const,
      input: insertSubscriberSchema,
      responses: {
        201: z.custom<typeof newsletterSubscribers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  checkout: {
    create: {
      method: 'POST' as const,
      path: '/api/checkout/submissions' as const,
      input: checkoutSubmissionInputSchema,
      responses: {
        201: checkoutSubmissionSchema,
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/checkout/submissions' as const,
      responses: {
        200: z.array(checkoutSubmissionSchema),
      },
    },
    stream: {
      method: 'GET' as const,
      path: '/api/checkout/submissions/stream' as const,
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/checkout/submissions/:id/status' as const,
      params: z.object({
        id: z.string().min(1),
      }),
      input: checkoutStatusUpdateSchema,
      responses: {
        200: checkoutSubmissionSchema,
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type SubscribeInput = z.infer<typeof api.newsletter.subscribe.input>;
export type SubscribeResponse = z.infer<typeof api.newsletter.subscribe.responses[201]>;
export type CreateCheckoutSubmissionInput = z.infer<typeof api.checkout.create.input>;
export type CreateCheckoutSubmissionResponse = z.infer<typeof api.checkout.create.responses[201]>;
export type CheckoutListResponse = z.infer<typeof api.checkout.list.responses[200]>;
export type CheckoutStatusUpdateInput = z.infer<typeof api.checkout.updateStatus.input>;
export type CheckoutStatusUpdateResponse = z.infer<typeof api.checkout.updateStatus.responses[200]>;
