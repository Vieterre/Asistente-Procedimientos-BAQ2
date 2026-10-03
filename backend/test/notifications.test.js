import test from "node:test";
import assert from "node:assert/strict";
import { listOwnNotifications, markAllOwnNotificationsRead, markOwnNotificationRead } from "../src/domain/notifications.js";

const notificationId = "33333333-3333-4333-8333-333333333333";
const recipient = { id: "11111111-1111-4111-8111-111111111111", role: "elaborador" };

test("notification list is limited to the current recipient and reports unread count", async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    return { rows: [{ id: notificationId, procedureId: "22222222-2222-4222-8222-222222222222", eventType: "procedure_evaluation_started", title: "La evaluación comenzó", message: "Borrador de prueba", createdAt: new Date("2026-10-03T12:00:00Z"), readAt: null, unreadCount: 3 }] };
  } };
  const result = await listOwnNotifications(pool, recipient);
  assert.deepEqual(calls[0].params, [recipient.id]);
  assert.match(calls[0].sql, /WHERE n\.recipient_user_id = \$1/);
  assert.equal(result.unreadCount, 3);
  assert.equal(result.notifications.length, 1);
  assert.equal("unreadCount" in result.notifications[0], false);
});

test("notification updates are recipient-scoped and missing foreign notifications return not found", async () => {
  const calls = [];
  let exists = true;
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("UPDATE user_notifications SET read_at = COALESCE")) return { rows: exists ? [{ id: notificationId }] : [] };
    return { rowCount: 2, rows: [] };
  } };
  await markOwnNotificationRead(pool, recipient, notificationId);
  assert.deepEqual(calls[0].params, [notificationId, recipient.id]);
  assert.match(calls[0].sql, /recipient_user_id = \$2/);
  exists = false;
  await assert.rejects(markOwnNotificationRead(pool, recipient, notificationId), { code: "notification_not_found", status: 404 });
  assert.equal(await markAllOwnNotificationsRead(pool, recipient), 2);
  assert.deepEqual(calls[2].params, [recipient.id]);
});
