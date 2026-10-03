export class NotificationError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export async function listOwnNotifications(pool, user) {
  const result = await pool.query(
    `SELECT n.id, n.procedure_id AS "procedureId", n.event_type AS "eventType",
            n.title, n.message, n.created_at AS "createdAt", n.read_at AS "readAt",
            (SELECT count(*)::int FROM user_notifications unread
              WHERE unread.recipient_user_id = $1 AND unread.read_at IS NULL) AS "unreadCount"
       FROM user_notifications n
      WHERE n.recipient_user_id = $1
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 50`,
    [user.id]
  );
  return {
    notifications: result.rows.map(({ unreadCount, ...notification }) => notification),
    unreadCount: Number(result.rows[0]?.unreadCount || 0)
  };
}

export async function markOwnNotificationRead(pool, user, id) {
  const result = await pool.query(
    `UPDATE user_notifications SET read_at = COALESCE(read_at, now())
      WHERE id = $1 AND recipient_user_id = $2
      RETURNING id`,
    [id, user.id]
  );
  if (!result.rows.length) throw new NotificationError("notification_not_found", 404);
}

export async function markAllOwnNotificationsRead(pool, user) {
  const result = await pool.query(
    `UPDATE user_notifications SET read_at = now()
      WHERE recipient_user_id = $1 AND read_at IS NULL`,
    [user.id]
  );
  return result.rowCount;
}
