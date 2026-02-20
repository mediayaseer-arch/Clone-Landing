import { newsletterSubscribers } from "@shared/schema";
import type { InsertSubscriber, Subscriber } from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber>;
}

export class DatabaseStorage implements IStorage {
  async createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber> {
    const [newSubscriber] = await db.insert(newsletterSubscribers)
      .values(subscriber)
      .returning();
    return newSubscriber;
  }
}

export const storage = new DatabaseStorage();
