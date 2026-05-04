import type { FastifyBaseLogger } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Buffer } from 'node:buffer';
import { pool, query, queryOne } from './db.ts';
import type { AiModerationStatus } from './aiModeration.ts';

type QueryValue = string | string[] | undefined;
type NotificationModerationStatus = Extract<AiModerationStatus, 'approved' | 'rejected' | 'failed'>;
type NotificationType =
  | 'life_post_comment'
  | 'life_comment_reply'
  | 'discussion_comment_reply'
  | 'life_post_reaction'
  | 'moderation_result';
type LifeReactionType = 'like' | 'helpful' | 'fun' | 'thanks';
type DiscussionEntityType = 'pokemon' | 'items' | 'recipes' | 'habitats' | 'ancient-artifacts';
type NotificationTargetType = 'life-post' | 'life-comment' | 'discussion-comment';
type ModerationTargetType = 'life-post' | 'life-comment' | 'discussion-comment';

type NotificationCursor = {
  createdAt: string;
  id: number;
};

type NotificationActor = {
  id: number;
  displayName: string;
};

type NotificationRow = {
  id: number;
  recipientUserId: number;
  actor: NotificationActor | null;
  type: NotificationType;
  lifePostId: number | null;
  lifeCommentId: number | null;
  parentLifeCommentId: number | null;
  discussionCommentId: number | null;
  parentDiscussionCommentId: number | null;
  entityType: DiscussionEntityType | null;
  entityId: number | null;
  reactionType: LifeReactionType | null;
  moderationStatus: NotificationModerationStatus | null;
  readAt: Date | null;
  createdAt: Date;
  createdAtCursor: string;
  updatedAt: Date;
};

export type NotificationTarget = {
  type: NotificationTargetType;
  id: number;
  path: string;
  lifePostId: number | null;
  lifeCommentId: number | null;
  discussionCommentId: number | null;
  entityType: DiscussionEntityType | null;
  entityId: number | null;
};

export type NotificationItem = {
  id: number;
  type: NotificationType;
  actor: NotificationActor | null;
  target: NotificationTarget;
  reactionType: LifeReactionType | null;
  moderationStatus: NotificationModerationStatus | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationsPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
};

type NotificationWsMessage =
  | { type: 'notifications.connected'; unreadCount: number }
  | { type: 'notifications.created'; notification: NotificationItem; unreadCount: number }
  | { type: 'notifications.unread'; unreadCount: number }
  | {
      type: 'moderation.updated';
      target: NotificationTarget;
      moderationStatus: NotificationModerationStatus;
      moderationLanguageCode: string | null;
    };

const defaultNotificationLimit = 15;
const maxNotificationLimit = 50;
const websocketTicketMinutes = 2;
const websocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const notificationClients = new Map<number, Set<Duplex>>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function asString(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cleanNotificationLimit(value: QueryValue): number {
  const rawLimit = asString(value);
  if (!rawLimit) {
    return defaultNotificationLimit;
  }

  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, maxNotificationLimit) : defaultNotificationLimit;
}

function decodeNotificationCursor(value: QueryValue): NotificationCursor | null {
  const rawCursor = asString(value);
  if (!rawCursor) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as Partial<NotificationCursor>;
    const createdAt = typeof cursor.createdAt === 'string' ? cursor.createdAt : '';
    const id = Number(cursor.id);
    if (!createdAt || Number.isNaN(new Date(createdAt).getTime()) || !Number.isInteger(id) || id <= 0) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeNotificationCursor(row: Pick<NotificationRow, 'createdAtCursor' | 'id'>): string {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAtCursor, id: row.id }), 'utf8').toString('base64url');
}

function notificationProjection(): string {
  return `
    SELECT
      n.id,
      n.recipient_user_id AS "recipientUserId",
      n.type,
      n.life_post_id AS "lifePostId",
      n.life_comment_id AS "lifeCommentId",
      n.parent_life_comment_id AS "parentLifeCommentId",
      n.discussion_comment_id AS "discussionCommentId",
      n.parent_discussion_comment_id AS "parentDiscussionCommentId",
      n.entity_type AS "entityType",
      n.entity_id AS "entityId",
      n.reaction_type AS "reactionType",
      n.moderation_status AS "moderationStatus",
      n.read_at AS "readAt",
      n.created_at AS "createdAt",
      n.created_at::text AS "createdAtCursor",
      n.updated_at AS "updatedAt",
      CASE
        WHEN actor_user.id IS NULL THEN NULL
        ELSE json_build_object('id', actor_user.id, 'displayName', actor_user.display_name)
      END AS actor
    FROM notifications n
    LEFT JOIN users actor_user ON actor_user.id = n.actor_user_id
  `;
}

function discussionEntityPath(entityType: DiscussionEntityType | null, entityId: number | null): string | null {
  if (!entityType || !entityId) {
    return null;
  }

  return `/${entityType}/${entityId}`;
}

function notificationTargetType(row: NotificationRow): NotificationTargetType {
  if (row.discussionCommentId !== null) {
    return 'discussion-comment';
  }
  if (row.lifeCommentId !== null) {
    return 'life-comment';
  }
  return 'life-post';
}

function notificationPath(row: NotificationRow): string {
  if (row.lifePostId !== null) {
    return `/life/${row.lifePostId}`;
  }

  return discussionEntityPath(row.entityType, row.entityId) ?? '/';
}

function toNotificationItem(row: NotificationRow): NotificationItem {
  const targetType = notificationTargetType(row);
  const targetId =
    targetType === 'discussion-comment'
      ? row.discussionCommentId
      : targetType === 'life-comment'
        ? row.lifeCommentId
        : row.lifePostId;

  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    target: {
      type: targetType,
      id: targetId ?? 0,
      path: notificationPath(row),
      lifePostId: row.lifePostId,
      lifeCommentId: row.lifeCommentId,
      discussionCommentId: row.discussionCommentId,
      entityType: row.entityType,
      entityId: row.entityId
    },
    reactionType: row.reactionType,
    moderationStatus: row.moderationStatus,
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function unreadNotificationCount(userId: number): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `
      SELECT COUNT(*)::integer AS total
      FROM notifications
      WHERE recipient_user_id = $1
        AND read_at IS NULL
    `,
    [userId]
  );
  return row?.total ?? 0;
}

async function getNotificationById(id: number, userId?: number): Promise<NotificationItem | null> {
  const params: unknown[] = [id];
  const conditions = ['n.id = $1'];
  if (userId !== undefined) {
    params.push(userId);
    conditions.push(`n.recipient_user_id = $${params.length}`);
  }

  const row = await queryOne<NotificationRow>(
    `
      ${notificationProjection()}
      WHERE ${conditions.join(' AND ')}
    `,
    params
  );
  return row ? toNotificationItem(row) : null;
}

async function publishNotification(notificationId: number, userId: number): Promise<void> {
  const notification = await getNotificationById(notificationId, userId);
  if (!notification) {
    return;
  }

  broadcastNotificationMessage(userId, {
    type: 'notifications.created',
    notification,
    unreadCount: await unreadNotificationCount(userId)
  });
}

async function publishUnreadCount(userId: number): Promise<void> {
  broadcastNotificationMessage(userId, {
    type: 'notifications.unread',
    unreadCount: await unreadNotificationCount(userId)
  });
}

async function publishModerationUpdate(
  userId: number,
  target: NotificationTarget,
  moderationStatus: NotificationModerationStatus,
  moderationLanguageCode: string | null
): Promise<void> {
  broadcastNotificationMessage(userId, {
    type: 'moderation.updated',
    target,
    moderationStatus,
    moderationLanguageCode
  });
}

async function publishInsertedNotification(row: { id: number; recipientUserId: number } | null): Promise<void> {
  if (row) {
    await publishNotification(row.id, row.recipientUserId);
  }
}

export async function listNotifications(userId: number, paramsQuery: Record<string, QueryValue>): Promise<NotificationsPage> {
  const limit = cleanNotificationLimit(paramsQuery.limit);
  const cursor = decodeNotificationCursor(paramsQuery.cursor);
  const params: unknown[] = [userId];
  const conditions = ['n.recipient_user_id = $1'];

  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(n.created_at, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::integer)`);
  }

  params.push(limit + 1);
  const rows = await query<NotificationRow>(
    `
      ${notificationProjection()}
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $${params.length}
    `,
    params
  );
  const items = rows.slice(0, limit);
  const last = items.at(-1) ?? null;

  return {
    items: items.map(toNotificationItem),
    nextCursor: rows.length > limit && last ? encodeNotificationCursor(last) : null,
    hasMore: rows.length > limit,
    unreadCount: await unreadNotificationCount(userId)
  };
}

export async function markNotificationRead(notificationId: number, userId: number): Promise<{
  notification: NotificationItem | null;
  unreadCount: number;
}> {
  const row = await queryOne<{ id: number }>(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, now()),
          updated_at = now()
      WHERE id = $1
        AND recipient_user_id = $2
      RETURNING id
    `,
    [notificationId, userId]
  );
  const unreadCount = await unreadNotificationCount(userId);
  if (row) {
    broadcastNotificationMessage(userId, { type: 'notifications.unread', unreadCount });
  }

  return {
    notification: row ? await getNotificationById(row.id, userId) : null,
    unreadCount
  };
}

export async function markAllNotificationsRead(userId: number): Promise<{ unreadCount: number }> {
  await pool.query(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, now()),
          updated_at = now()
      WHERE recipient_user_id = $1
        AND read_at IS NULL
    `,
    [userId]
  );
  await publishUnreadCount(userId);
  return { unreadCount: 0 };
}

export async function createNotificationWebSocketTicket(userId: number): Promise<{ ticket: string; expiresAt: Date }> {
  await pool.query(
    `
      DELETE FROM notification_ws_tickets
      WHERE expires_at <= now()
        OR used_at IS NOT NULL
    `
  );

  const ticket = randomBytes(32).toString('base64url');
  const row = await queryOne<{ expiresAt: Date }>(
    `
      INSERT INTO notification_ws_tickets (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + ($3 * interval '1 minute'))
      RETURNING expires_at AS "expiresAt"
    `,
    [userId, hashToken(ticket), websocketTicketMinutes]
  );

  return { ticket, expiresAt: row?.expiresAt ?? new Date(Date.now() + websocketTicketMinutes * 60 * 1000) };
}

async function consumeNotificationWebSocketTicket(ticket: string): Promise<number | null> {
  if (ticket.length < 32) {
    return null;
  }

  const row = await queryOne<{ userId: number }>(
    `
      UPDATE notification_ws_tickets
      SET used_at = now()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id AS "userId"
    `,
    [hashToken(ticket)]
  );

  return row?.userId ?? null;
}

export async function createLifePostReactionNotification(postId: number, actorUserId: number): Promise<void> {
  const row = await queryOne<{ id: number; recipientUserId: number }>(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        type,
        life_post_id,
        reaction_type,
        read_at,
        created_at,
        updated_at
      )
      SELECT
        lp.created_by_user_id,
        lpr.user_id,
        'life_post_reaction',
        lpr.post_id,
        lpr.reaction_type,
        NULL,
        now(),
        now()
      FROM life_post_reactions lpr
      JOIN life_posts lp ON lp.id = lpr.post_id
      WHERE lpr.post_id = $1
        AND lpr.user_id = $2
        AND lp.deleted_at IS NULL
        AND lp.created_by_user_id IS NOT NULL
        AND lp.created_by_user_id <> lpr.user_id
      ON CONFLICT (recipient_user_id, actor_user_id, life_post_id)
      WHERE type = 'life_post_reaction' AND actor_user_id IS NOT NULL AND life_post_id IS NOT NULL
      DO UPDATE SET reaction_type = EXCLUDED.reaction_type,
                    read_at = NULL,
                    created_at = now(),
                    updated_at = now()
      RETURNING id, recipient_user_id AS "recipientUserId"
    `,
    [postId, actorUserId]
  );

  await publishInsertedNotification(row);
}

export async function createApprovedCommentNotification(target: {
  type: ModerationTargetType;
  id: number;
}): Promise<void> {
  if (target.type === 'life-comment') {
    const row = await queryOne<{ id: number; recipientUserId: number }>(
      `
        WITH source AS (
          SELECT
            lc.id,
            lc.post_id,
            lc.parent_comment_id,
            lc.created_by_user_id AS actor_user_id,
            CASE
              WHEN lc.parent_comment_id IS NULL THEN lp.created_by_user_id
              ELSE parent_comment.created_by_user_id
            END AS recipient_user_id
          FROM life_post_comments lc
          JOIN life_posts lp ON lp.id = lc.post_id
          LEFT JOIN life_post_comments parent_comment ON parent_comment.id = lc.parent_comment_id
          WHERE lc.id = $1
            AND lc.deleted_at IS NULL
            AND lc.ai_moderation_status = 'approved'
            AND lp.deleted_at IS NULL
        )
        INSERT INTO notifications (
          recipient_user_id,
          actor_user_id,
          type,
          life_post_id,
          life_comment_id,
          parent_life_comment_id
        )
        SELECT
          recipient_user_id,
          actor_user_id,
          CASE WHEN parent_comment_id IS NULL THEN 'life_post_comment' ELSE 'life_comment_reply' END,
          post_id,
          id,
          parent_comment_id
        FROM source
        WHERE recipient_user_id IS NOT NULL
          AND actor_user_id IS NOT NULL
          AND recipient_user_id <> actor_user_id
        ON CONFLICT DO NOTHING
        RETURNING id, recipient_user_id AS "recipientUserId"
      `,
      [target.id]
    );

    await publishInsertedNotification(row);
    return;
  }

  if (target.type === 'discussion-comment') {
    const row = await queryOne<{ id: number; recipientUserId: number }>(
      `
        WITH source AS (
          SELECT
            edc.id,
            edc.entity_type,
            edc.entity_id,
            edc.parent_comment_id,
            edc.created_by_user_id AS actor_user_id,
            parent_comment.created_by_user_id AS recipient_user_id
          FROM entity_discussion_comments edc
          JOIN entity_discussion_comments parent_comment ON parent_comment.id = edc.parent_comment_id
          WHERE edc.id = $1
            AND edc.deleted_at IS NULL
            AND edc.ai_moderation_status = 'approved'
            AND parent_comment.deleted_at IS NULL
        )
        INSERT INTO notifications (
          recipient_user_id,
          actor_user_id,
          type,
          discussion_comment_id,
          parent_discussion_comment_id,
          entity_type,
          entity_id
        )
        SELECT
          recipient_user_id,
          actor_user_id,
          'discussion_comment_reply',
          id,
          parent_comment_id,
          entity_type,
          entity_id
        FROM source
        WHERE recipient_user_id IS NOT NULL
          AND actor_user_id IS NOT NULL
          AND recipient_user_id <> actor_user_id
        ON CONFLICT DO NOTHING
        RETURNING id, recipient_user_id AS "recipientUserId"
      `,
      [target.id]
    );

    await publishInsertedNotification(row);
  }
}

export async function createModerationResultNotification(
  target: { type: ModerationTargetType; id: number },
  status: NotificationModerationStatus
): Promise<void> {
  if (target.type === 'life-post') {
    const row = await queryOne<{
      id: number;
      recipientUserId: number;
      moderationLanguageCode: string | null;
      lifePostId: number;
    }>(
      `
        INSERT INTO notifications (
          recipient_user_id,
          actor_user_id,
          type,
          life_post_id,
          moderation_status
        )
        SELECT created_by_user_id, NULL, 'moderation_result', id, $2
        FROM life_posts
        WHERE id = $1
          AND deleted_at IS NULL
          AND created_by_user_id IS NOT NULL
        RETURNING
          id,
          recipient_user_id AS "recipientUserId",
          (
            SELECT ai_moderation_language_code
            FROM life_posts
            WHERE id = $1
          ) AS "moderationLanguageCode",
          life_post_id AS "lifePostId"
      `,
      [target.id, status]
    );
    await publishInsertedNotification(row);
    if (row) {
      await publishModerationUpdate(
        row.recipientUserId,
        {
          type: 'life-post',
          id: row.lifePostId,
          path: `/life/${row.lifePostId}`,
          lifePostId: row.lifePostId,
          lifeCommentId: null,
          discussionCommentId: null,
          entityType: null,
          entityId: null
        },
        status,
        row.moderationLanguageCode
      );
    }
    return;
  }

  if (target.type === 'life-comment') {
    const row = await queryOne<{
      id: number;
      recipientUserId: number;
      moderationLanguageCode: string | null;
      lifePostId: number;
      lifeCommentId: number;
    }>(
      `
        INSERT INTO notifications (
          recipient_user_id,
          actor_user_id,
          type,
          life_post_id,
          life_comment_id,
          parent_life_comment_id,
          moderation_status
        )
        SELECT
          lc.created_by_user_id,
          NULL,
          'moderation_result',
          lc.post_id,
          lc.id,
          lc.parent_comment_id,
          $2
        FROM life_post_comments lc
        JOIN life_posts lp ON lp.id = lc.post_id
        WHERE lc.id = $1
          AND lc.deleted_at IS NULL
          AND lp.deleted_at IS NULL
          AND lc.created_by_user_id IS NOT NULL
        RETURNING
          id,
          recipient_user_id AS "recipientUserId",
          (
            SELECT ai_moderation_language_code
            FROM life_post_comments
            WHERE id = $1
          ) AS "moderationLanguageCode",
          life_post_id AS "lifePostId",
          life_comment_id AS "lifeCommentId"
      `,
      [target.id, status]
    );
    await publishInsertedNotification(row);
    if (row) {
      await publishModerationUpdate(
        row.recipientUserId,
        {
          type: 'life-comment',
          id: row.lifeCommentId,
          path: `/life/${row.lifePostId}`,
          lifePostId: row.lifePostId,
          lifeCommentId: row.lifeCommentId,
          discussionCommentId: null,
          entityType: null,
          entityId: null
        },
        status,
        row.moderationLanguageCode
      );
    }
    return;
  }

  const row = await queryOne<{
    id: number;
    recipientUserId: number;
    moderationLanguageCode: string | null;
    discussionCommentId: number;
    entityType: DiscussionEntityType;
    entityId: number;
  }>(
    `
      INSERT INTO notifications (
        recipient_user_id,
        actor_user_id,
        type,
        discussion_comment_id,
        parent_discussion_comment_id,
        entity_type,
        entity_id,
        moderation_status
      )
      SELECT
        created_by_user_id,
        NULL,
        'moderation_result',
        id,
        parent_comment_id,
        entity_type,
        entity_id,
        $2
      FROM entity_discussion_comments
      WHERE id = $1
        AND deleted_at IS NULL
        AND created_by_user_id IS NOT NULL
      RETURNING
        id,
        recipient_user_id AS "recipientUserId",
        (
          SELECT ai_moderation_language_code
          FROM entity_discussion_comments
          WHERE id = $1
        ) AS "moderationLanguageCode",
        discussion_comment_id AS "discussionCommentId",
        entity_type AS "entityType",
        entity_id AS "entityId"
    `,
    [target.id, status]
  );
  await publishInsertedNotification(row);
  if (row) {
    await publishModerationUpdate(
      row.recipientUserId,
      {
        type: 'discussion-comment',
        id: row.discussionCommentId,
        path: discussionEntityPath(row.entityType, row.entityId) ?? '/',
        lifePostId: null,
        lifeCommentId: null,
        discussionCommentId: row.discussionCommentId,
        entityType: row.entityType,
        entityId: row.entityId
      },
      status,
      row.moderationLanguageCode
    );
  }
}

function wsFrame(data: Buffer, opcode = 0x1): Buffer {
  const length = data.byteLength;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function sendWsJson(socket: Duplex, message: NotificationWsMessage): void {
  if (socket.destroyed) {
    return;
  }

  socket.write(wsFrame(Buffer.from(JSON.stringify(message), 'utf8')));
}

function broadcastNotificationMessage(userId: number, message: NotificationWsMessage): void {
  const sockets = notificationClients.get(userId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    try {
      sendWsJson(socket, message);
    } catch {
      socket.destroy();
      sockets.delete(socket);
    }
  }
}

function addNotificationClient(userId: number, socket: Duplex): void {
  const sockets = notificationClients.get(userId) ?? new Set<Duplex>();
  sockets.add(socket);
  notificationClients.set(userId, sockets);

  socket.once('close', () => {
    sockets.delete(socket);
    if (sockets.size === 0) {
      notificationClients.delete(userId);
    }
  });
}

function websocketPayload(buffer: Buffer): { opcode: number; payload: Buffer } | null {
  if (buffer.length < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  let payloadLength = buffer[1] & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    const largeLength = buffer.readBigUInt64BE(offset);
    if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    payloadLength = Number(largeLength);
    offset += 8;
  }

  const masked = (buffer[1] & 0x80) !== 0;
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (mask) {
    offset += 4;
  }
  if (buffer.length < offset + payloadLength) {
    return null;
  }

  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return { opcode, payload };
}

function closeSocket(socket: Duplex, statusCode = 1000): void {
  if (socket.destroyed) {
    return;
  }

  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(statusCode, 0);
  socket.end(wsFrame(payload, 0x8));
}

function rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function setupNotificationWebSocketServer(server: Server, logger: FastifyBaseLogger): void {
  server.on('upgrade', async (request, socket) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/notifications/ws') {
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (request.method !== 'GET' || typeof key !== 'string' || key.trim() === '') {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    try {
      const ticket = url.searchParams.get('ticket') ?? '';
      const userId = await consumeNotificationWebSocketTicket(ticket);
      if (!userId) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const accept = createHash('sha1').update(`${key}${websocketGuid}`).digest('base64');
      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          '\r\n'
        ].join('\r\n')
      );

      addNotificationClient(userId, socket);
      sendWsJson(socket, {
        type: 'notifications.connected',
        unreadCount: await unreadNotificationCount(userId)
      });

      socket.on('data', (buffer: Buffer) => {
        const frame = websocketPayload(buffer);
        if (!frame) {
          return;
        }

        if (frame.opcode === 0x8) {
          closeSocket(socket);
        } else if (frame.opcode === 0x9) {
          socket.write(wsFrame(frame.payload, 0x0a));
        }
      });
      socket.on('error', () => {
        socket.destroy();
      });
    } catch (error) {
      logger.warn({ err: error }, 'Notification WebSocket upgrade failed');
      rejectUpgrade(socket, 500, 'Internal Server Error');
    }
  });
}
