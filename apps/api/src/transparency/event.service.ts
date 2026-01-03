import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import {
  EventType,
  EventVisibility,
  EventEntityType,
  EventDoc,
  Timestamp,
} from "@opencause/firebase";

/**
 * Event Service - Single source of truth for all campaign activity
 * Emits events transactionally with data mutations
 */
@Injectable()
export class EventService {
  /**
   * Emit an event (should be called within a Firestore transaction)
   */
  async emitEvent(
    transaction: admin.firestore.Transaction,
    event: {
      campaignId: string;
      type: EventType;
      visibility?: EventVisibility;
      actorUserId?: string | null;
      entityType: EventEntityType;
      entityId: string;
      data: Record<string, any>;
    }
  ): Promise<string> {
    const db = admin.firestore();
    const eventRef = db.collection("events").doc();
    
    const eventDoc: EventDoc = {
      id: eventRef.id,
      campaignId: event.campaignId,
      type: event.type,
      visibility: event.visibility || "PUBLIC",
      actorUserId: event.actorUserId || null,
      entityType: event.entityType,
      entityId: event.entityId,
      data: event.data,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
      _campaignId: event.campaignId,
      _type: event.type,
      _entityType: event.entityType,
      _entityId: event.entityId,
    };
    
    transaction.set(eventRef, eventDoc);
    return eventRef.id;
  }

  /**
   * Get events for a campaign (public or organizer view)
   */
  async getCampaignEvents(
    campaignId: string,
    options: {
      visibility?: EventVisibility | EventVisibility[];
      limit?: number;
      startAfter?: admin.firestore.DocumentSnapshot;
    } = {}
  ): Promise<EventDoc[]> {
    const db = admin.firestore();
    
    // Always try the simple query first (without orderBy) to avoid index errors
    // This is more reliable than trying to catch index errors
    let query: admin.firestore.Query = db
      .collection("events")
      .where("campaignId", "==", campaignId);

    if (options.visibility) {
      if (Array.isArray(options.visibility)) {
        query = query.where("visibility", "in", options.visibility);
      } else {
        query = query.where("visibility", "==", options.visibility);
      }
    }

    if (options.limit) {
      query = query.limit(options.limit * 2); // Get more to sort, then limit
    }

    const snapshot = await query.get();
    let events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EventDoc[];

    // Sort in memory by createdAt (descending)
    events.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 
                   ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0) ||
                   0;
      const bTime = b.createdAt?.toMillis?.() || 
                   ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0) ||
                   0;
      return bTime - aTime;
    });

    // Apply limit after sorting
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Get events for a specific entity
   */
  async getEntityEvents(
    entityType: EventEntityType,
    entityId: string
  ): Promise<EventDoc[]> {
    const db = admin.firestore();
    const snapshot = await db
      .collection("events")
      .where("_entityType", "==", entityType)
      .where("_entityId", "==", entityId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EventDoc[];
  }
}

