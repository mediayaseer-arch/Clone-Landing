import { z } from 'zod';
import { insertSubscriberSchema, newsletterSubscribers } from './schema';

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
