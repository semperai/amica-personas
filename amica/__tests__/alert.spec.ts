import { describe, expect, test, beforeEach } from "vitest";
import { Alert } from "../src/features/alert/alert";
import type { Notification, NotificationType } from "../src/features/alert/alert";

describe("Alert", () => {
  let alert: Alert;

  beforeEach(() => {
    alert = new Alert();
  });

  describe("initialization", () => {
    test("should initialize with empty notifications array", () => {
      expect(alert.notifications).toEqual([]);
      expect(alert.notifications.length).toBe(0);
    });
  });

  describe("success", () => {
    test("should add success notification", () => {
      alert.success("Success Title", "Success message");

      expect(alert.notifications.length).toBe(1);
      expect(alert.notifications[0]).toEqual({
        type: "success",
        title: "Success Title",
        message: "Success message",
      });
    });

    test("should add multiple success notifications", () => {
      alert.success("First", "Message 1");
      alert.success("Second", "Message 2");
      alert.success("Third", "Message 3");

      expect(alert.notifications.length).toBe(3);
      expect(alert.notifications[0].title).toBe("First");
      expect(alert.notifications[1].title).toBe("Second");
      expect(alert.notifications[2].title).toBe("Third");
    });

    test("should preserve order of notifications", () => {
      alert.success("A", "Message A");
      alert.success("B", "Message B");
      alert.success("C", "Message C");

      expect(alert.notifications[0].title).toBe("A");
      expect(alert.notifications[1].title).toBe("B");
      expect(alert.notifications[2].title).toBe("C");
    });

    test("should handle empty title", () => {
      alert.success("", "Message");

      expect(alert.notifications[0].title).toBe("");
      expect(alert.notifications[0].message).toBe("Message");
    });

    test("should handle empty message", () => {
      alert.success("Title", "");

      expect(alert.notifications[0].title).toBe("Title");
      expect(alert.notifications[0].message).toBe("");
    });

    test("should handle both empty title and message", () => {
      alert.success("", "");

      expect(alert.notifications[0].title).toBe("");
      expect(alert.notifications[0].message).toBe("");
    });

    test("should handle long titles", () => {
      const longTitle = "A".repeat(1000);
      alert.success(longTitle, "Message");

      expect(alert.notifications[0].title).toBe(longTitle);
      expect(alert.notifications[0].title.length).toBe(1000);
    });

    test("should handle long messages", () => {
      const longMessage = "B".repeat(10000);
      alert.success("Title", longMessage);

      expect(alert.notifications[0].message).toBe(longMessage);
      expect(alert.notifications[0].message.length).toBe(10000);
    });

    test("should handle special characters in title", () => {
      alert.success("Title with <html> & \"quotes\"", "Message");

      expect(alert.notifications[0].title).toBe("Title with <html> & \"quotes\"");
    });

    test("should handle special characters in message", () => {
      alert.success("Title", "Message with\nnewlines\tand\ttabs");

      expect(alert.notifications[0].message).toBe("Message with\nnewlines\tand\ttabs");
    });

    test("should handle unicode characters", () => {
      alert.success("Title 👍", "Message with 中文 and 日本語");

      expect(alert.notifications[0].title).toBe("Title 👍");
      expect(alert.notifications[0].message).toBe("Message with 中文 and 日本語");
    });
  });

  describe("error", () => {
    test("should add error notification", () => {
      alert.error("Error Title", "Error message");

      expect(alert.notifications.length).toBe(1);
      expect(alert.notifications[0]).toEqual({
        type: "error",
        title: "Error Title",
        message: "Error message",
      });
    });

    test("should add multiple error notifications", () => {
      alert.error("Error 1", "Message 1");
      alert.error("Error 2", "Message 2");
      alert.error("Error 3", "Message 3");

      expect(alert.notifications.length).toBe(3);
      expect(alert.notifications[0].title).toBe("Error 1");
      expect(alert.notifications[1].title).toBe("Error 2");
      expect(alert.notifications[2].title).toBe("Error 3");
    });

    test("should handle empty title", () => {
      alert.error("", "Error message");

      expect(alert.notifications[0].title).toBe("");
      expect(alert.notifications[0].message).toBe("Error message");
    });

    test("should handle empty message", () => {
      alert.error("Error", "");

      expect(alert.notifications[0].title).toBe("Error");
      expect(alert.notifications[0].message).toBe("");
    });

    test("should handle error details with stack traces", () => {
      const errorMessage = "Error: Something went wrong\n  at function1\n  at function2";
      alert.error("Application Error", errorMessage);

      expect(alert.notifications[0].message).toContain("Error: Something went wrong");
      expect(alert.notifications[0].message).toContain("at function1");
    });
  });

  describe("mixed notifications", () => {
    test("should handle mixed success and error notifications", () => {
      alert.success("Success 1", "All good");
      alert.error("Error 1", "Something bad");
      alert.success("Success 2", "Good again");

      expect(alert.notifications.length).toBe(3);
      expect(alert.notifications[0].type).toBe("success");
      expect(alert.notifications[1].type).toBe("error");
      expect(alert.notifications[2].type).toBe("success");
    });

    test("should maintain insertion order with mixed types", () => {
      alert.error("E1", "Error 1");
      alert.success("S1", "Success 1");
      alert.error("E2", "Error 2");
      alert.success("S2", "Success 2");

      const titles = alert.notifications.map(n => n.title);
      expect(titles).toEqual(["E1", "S1", "E2", "S2"]);
    });
  });

  describe("notification types", () => {
    test("should correctly identify success notification type", () => {
      alert.success("Title", "Message");

      const notification = alert.notifications[0];
      expect(notification.type).toBe("success");
      expect(notification.type === "success").toBe(true);
      expect(notification.type === "error").toBe(false);
    });

    test("should correctly identify error notification type", () => {
      alert.error("Title", "Message");

      const notification = alert.notifications[0];
      expect(notification.type).toBe("error");
      expect(notification.type === "error").toBe(true);
      expect(notification.type === "success").toBe(false);
    });
  });

  describe("notifications array", () => {
    test("should be directly accessible", () => {
      alert.success("Title", "Message");

      // Direct array access
      expect(Array.isArray(alert.notifications)).toBe(true);
      expect(alert.notifications[0].title).toBe("Title");
    });

    test("should be mutable", () => {
      alert.success("Title", "Message");

      // Can be cleared
      alert.notifications = [];
      expect(alert.notifications.length).toBe(0);
    });

    test("should allow filtering", () => {
      alert.success("S1", "Success 1");
      alert.error("E1", "Error 1");
      alert.success("S2", "Success 2");

      const errors = alert.notifications.filter(n => n.type === "error");
      const successes = alert.notifications.filter(n => n.type === "success");

      expect(errors.length).toBe(1);
      expect(successes.length).toBe(2);
    });

    test("should allow mapping", () => {
      alert.success("S1", "Success 1");
      alert.error("E1", "Error 1");

      const titles = alert.notifications.map(n => n.title);
      expect(titles).toEqual(["S1", "E1"]);
    });

    test("should support array methods", () => {
      alert.success("First", "Message 1");
      alert.error("Second", "Message 2");
      alert.success("Third", "Message 3");

      // Find
      const errorNotification = alert.notifications.find(n => n.type === "error");
      expect(errorNotification?.title).toBe("Second");

      // Some
      const hasErrors = alert.notifications.some(n => n.type === "error");
      expect(hasErrors).toBe(true);

      // Every
      const allSuccess = alert.notifications.every(n => n.type === "success");
      expect(allSuccess).toBe(false);
    });
  });

  describe("real-world scenarios", () => {
    test("should handle API success notification", () => {
      alert.success("Data Saved", "Your changes have been saved successfully.");

      expect(alert.notifications[0]).toEqual({
        type: "success",
        title: "Data Saved",
        message: "Your changes have been saved successfully.",
      });
    });

    test("should handle API error notification", () => {
      alert.error(
        "Network Error",
        "Failed to connect to server. Please check your internet connection."
      );

      expect(alert.notifications[0]).toEqual({
        type: "error",
        title: "Network Error",
        message: "Failed to connect to server. Please check your internet connection.",
      });
    });

    test("should handle validation error", () => {
      alert.error("Validation Error", "Email field is required.");

      expect(alert.notifications[0].type).toBe("error");
      expect(alert.notifications[0].title).toBe("Validation Error");
    });

    test("should handle file upload success", () => {
      alert.success("Upload Complete", "model.vrm has been uploaded successfully.");

      expect(alert.notifications[0].message).toContain("model.vrm");
    });

    test("should handle authentication error", () => {
      alert.error("Authentication Failed", "Invalid credentials. Please try again.");

      expect(alert.notifications[0].type).toBe("error");
    });

    test("should handle multiple concurrent operations", () => {
      alert.success("File 1 uploaded", "File 1 complete");
      alert.success("File 2 uploaded", "File 2 complete");
      alert.error("File 3 failed", "File 3 error");
      alert.success("File 4 uploaded", "File 4 complete");

      const successCount = alert.notifications.filter(n => n.type === "success").length;
      const errorCount = alert.notifications.filter(n => n.type === "error").length;

      expect(successCount).toBe(3);
      expect(errorCount).toBe(1);
    });

    test("should handle rapid successive notifications", () => {
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          alert.success(`Success ${i}`, `Message ${i}`);
        } else {
          alert.error(`Error ${i}`, `Message ${i}`);
        }
      }

      expect(alert.notifications.length).toBe(100);
      expect(alert.notifications[0].title).toBe("Success 0");
      expect(alert.notifications[99].title).toBe("Error 99");
    });
  });

  describe("memory and performance", () => {
    test("should handle many notifications efficiently", () => {
      const count = 1000;

      for (let i = 0; i < count; i++) {
        alert.success(`Title ${i}`, `Message ${i}`);
      }

      expect(alert.notifications.length).toBe(count);
      expect(alert.notifications[0].title).toBe("Title 0");
      expect(alert.notifications[count - 1].title).toBe(`Title ${count - 1}`);
    });

    test("should allow manual cleanup", () => {
      alert.success("Notification 1", "Message 1");
      alert.success("Notification 2", "Message 2");
      alert.success("Notification 3", "Message 3");

      // Manual cleanup - remove first notification
      alert.notifications.shift();

      expect(alert.notifications.length).toBe(2);
      expect(alert.notifications[0].title).toBe("Notification 2");
    });

    test("should allow clearing all notifications", () => {
      alert.success("Notification 1", "Message 1");
      alert.error("Notification 2", "Message 2");
      alert.success("Notification 3", "Message 3");

      // Clear all
      alert.notifications = [];

      expect(alert.notifications.length).toBe(0);
    });
  });

  describe("type safety", () => {
    test("notification should have correct structure", () => {
      alert.success("Title", "Message");

      const notification: Notification = alert.notifications[0];

      expect(notification).toHaveProperty("type");
      expect(notification).toHaveProperty("title");
      expect(notification).toHaveProperty("message");
    });

    test("notification type should be valid", () => {
      alert.success("Title", "Message");

      const notificationType: NotificationType = alert.notifications[0].type;

      expect(notificationType === "success" || notificationType === "error").toBe(true);
    });
  });
});
