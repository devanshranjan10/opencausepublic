import { Injectable } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";

@Injectable()
export class NotificationsService {
  constructor(private firebase: FirebaseService) {}

  async create(userId: string, data: { type: string; title: string; message: string; link?: string }) {
    return this.firebase.create("notifications", {
      userId,
      ...data,
      read: false,
    });
  }

  async findByUser(userId: string, unreadOnly = false) {
    const filters: Array<{ field: string; operator: any; value: any }> = [{ field: "userId", operator: "==", value: userId }];
    if (unreadOnly) {
      filters.push({ field: "read", operator: "==", value: false as any });
    }
    
    const notifications = await this.firebase.queryAll("notifications", filters);
    
    return notifications
      .sort((a: any, b: any) => {
        const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 50);
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.firebase.update("notifications", notificationId, { read: true });
  }

  async markAllAsRead(userId: string) {
    const notifications = await this.firebase.query("notifications", "userId", "==", userId);
    const unread = notifications.filter((n) => !n.read);
    
    await Promise.all(
      unread.map((n) => this.firebase.update("notifications", n.id, { read: true }))
    );
    
    return { updated: unread.length };
  }
}

