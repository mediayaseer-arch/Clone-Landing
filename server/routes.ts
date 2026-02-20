import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  CheckoutSubmissionNotFoundError,
  createCheckoutSubmission,
  listCheckoutSubmissions,
  updateCheckoutSubmissionStatus,
} from "./checkout-storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.newsletter.subscribe.path, async (req, res) => {
    try {
      const input = api.newsletter.subscribe.input.parse(req.body);
      const subscriber = await storage.createSubscriber(input);
      res.status(201).json(subscriber);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      
      if (err instanceof Error && err.message.includes('unique constraint')) {
        return res.status(400).json({ message: "This email is already subscribed!" });
      }
      throw err;
    }
  });

  app.post(api.checkout.create.path, async (req, res) => {
    try {
      const input = api.checkout.create.input.parse(req.body);
      const submission = await createCheckoutSubmission(input);
      res.status(201).json(submission);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to save checkout data to Firestore: ${err.message}`,
        });
      }

      throw err;
    }
  });

  app.get(api.checkout.list.path, async (_req, res) => {
    try {
      const submissions = await listCheckoutSubmissions();
      res.status(200).json(submissions);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to read checkout data from Firestore: ${err.message}`,
        });
      }
      throw err;
    }
  });

  app.patch(api.checkout.updateStatus.path, async (req, res) => {
    try {
      const { id } = api.checkout.updateStatus.params.parse(req.params);
      const input = api.checkout.updateStatus.input.parse(req.body);
      const updated = await updateCheckoutSubmissionStatus(id, input);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      if (err instanceof CheckoutSubmissionNotFoundError) {
        return res.status(404).json({ message: "Checkout record not found." });
      }

      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to update checkout data in Firestore: ${err.message}`,
        });
      }
      throw err;
    }
  });

  return httpServer;
}
