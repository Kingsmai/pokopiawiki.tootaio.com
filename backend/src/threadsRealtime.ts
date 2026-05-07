import type { FastifyBaseLogger } from 'fastify';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { pool, query, queryOne } from './db.ts';
import type { ThreadMessage, ThreadReactionCounts, ThreadReactionType, ThreadSummary } from './queries.ts';

export type ThreadWsMessage =
  | { type: 'threads.connected'; followedUnreadCount: number }
  | { type: 'thread.message.created'; threadId: number; message: ThreadMessage; thread: ThreadSummary }
  | { type: 'thread.message.moderation'; threadId: number; messageId: number; message: ThreadMessage | null }
  | {
      type: 'thread.reactions.updated';
      target: 'thread' | 'message';
      threadId: number;
      messageId: number | null;
      reactionCounts: ThreadReactionCounts;
      myReactions: ThreadReactionType[];
    }
  | { type: 'thread.read.updated'; threadId: number; unread: boolean; unreadCount: number };

const websocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const websocketTicketMinutes = 2;
const threadClients = new Map<number, Set<Duplex>>();
const clientUsers = new WeakMap<Duplex, number>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createThreadWebSocketTicket(userId: number): Promise<{ ticket: string; expiresAt: Date }> {
  const ticket = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + websocketTicketMinutes * 60_000);
  await pool.query(
    `
      INSERT INTO thread_ws_tickets (ticket_hash, user_id, expires_at)
      VALUES ($1, $2, $3)
    `,
    [hashToken(ticket), userId, expiresAt]
  );
  await pool.query('DELETE FROM thread_ws_tickets WHERE expires_at < now()');
  return { ticket, expiresAt };
}

async function consumeThreadWebSocketTicket(ticket: string): Promise<number | null> {
  if (!ticket) {
    return null;
  }

  const row = await queryOne<{ userId: number }>(
    `
      DELETE FROM thread_ws_tickets
      WHERE ticket_hash = $1
        AND expires_at > now()
      RETURNING user_id AS "userId"
    `,
    [hashToken(ticket)]
  );
  return row?.userId ?? null;
}

async function followedUnreadCount(userId: number): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `
      SELECT COUNT(*)::integer AS count
      FROM thread_follows tf
      JOIN threads t ON t.id = tf.thread_id
      LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = tf.user_id
      WHERE tf.user_id = $1
        AND t.deleted_at IS NULL
        AND t.last_message_id IS NOT NULL
        AND (
          tr.last_read_message_id IS NULL
          OR t.last_message_id > tr.last_read_message_id
        )
    `,
    [userId]
  );
  return row?.count ?? 0;
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

function sendWsJson(socket: Duplex, message: ThreadWsMessage): void {
  if (!socket.destroyed) {
    socket.write(wsFrame(Buffer.from(JSON.stringify(message), 'utf8')));
  }
}

function websocketPayload(buffer: Buffer): { opcode: number; payload: Buffer } | null {
  if (buffer.byteLength < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.byteLength < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.byteLength < offset + 8) return null;
    const longLength = buffer.readBigUInt64BE(offset);
    if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    length = Number(longLength);
    offset += 8;
  }

  let mask: Buffer | null = null;
  if (masked) {
    if (buffer.byteLength < offset + 4) return null;
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.byteLength < offset + length) {
    return null;
  }

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.byteLength; index += 1) {
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

function addThreadClient(userId: number, socket: Duplex): void {
  clientUsers.set(socket, userId);
  let clients = threadClients.get(userId);
  if (!clients) {
    clients = new Set();
    threadClients.set(userId, clients);
  }
  clients.add(socket);
  socket.on('close', () => {
    clients?.delete(socket);
    if (clients?.size === 0) {
      threadClients.delete(userId);
    }
  });
}

async function recipientUserIds(threadId: number): Promise<number[]> {
  const rows = await query<{ userId: number }>(
    `
      SELECT DISTINCT user_id AS "userId"
      FROM thread_follows
      WHERE thread_id = $1
    `,
    [threadId]
  );
  return rows.map((row) => row.userId);
}

function connectedUserIds(): number[] {
  return [...threadClients.keys()];
}

async function publishToUsers(userIds: number[], message: ThreadWsMessage): Promise<void> {
  for (const userId of userIds) {
    const clients = threadClients.get(userId);
    if (!clients) {
      continue;
    }
    for (const socket of clients) {
      sendWsJson(socket, message);
    }
  }
}

export async function publishThreadMessageCreated(thread: ThreadSummary, message: ThreadMessage): Promise<void> {
  const users = [...new Set([...(await recipientUserIds(thread.id)), ...connectedUserIds()])];
  if (message.author?.id && !users.includes(message.author.id)) {
    users.push(message.author.id);
  }
  await publishToUsers(users, {
    type: 'thread.message.created',
    threadId: thread.id,
    message,
    thread
  });
}

export async function applyApprovedThreadMessage(messageId: number): Promise<void> {
  const row = await queryOne<{
    threadId: number;
    channelId: number;
    title: string;
    languageCode: string;
    locked: boolean;
    messageCount: number;
    lastActiveAt: Date;
    threadCreatedAt: Date;
    threadAuthor: { id: number; displayName: string } | null;
    messageBody: string;
    moderationStatus: ThreadMessage['moderationStatus'];
    moderationLanguageCode: string | null;
    moderationReason: string | null;
    messageCreatedAt: Date;
    messageUpdatedAt: Date;
    messageAuthor: { id: number; displayName: string } | null;
  }>(
    `
      WITH updated_thread AS (
        UPDATE threads t
        SET last_message_id = tm.id,
            message_count = (
              SELECT COUNT(*)::integer
              FROM thread_messages visible_message
              WHERE visible_message.thread_id = t.id
                AND visible_message.deleted_at IS NULL
                AND visible_message.ai_moderation_status = 'approved'
            ),
            last_active_at = GREATEST(t.last_active_at, tm.created_at),
            updated_at = now()
        FROM thread_messages tm
        WHERE tm.id = $1
          AND tm.thread_id = t.id
          AND tm.deleted_at IS NULL
          AND tm.ai_moderation_status = 'approved'
        RETURNING
          t.id,
          t.channel_id,
          t.title,
          t.language_code,
          t.locked,
          t.message_count,
          t.last_active_at,
          t.created_at,
          t.created_by_user_id
      )
      SELECT
        ut.id AS "threadId",
        ut.channel_id AS "channelId",
        ut.title,
        ut.language_code AS "languageCode",
        ut.locked,
        ut.message_count AS "messageCount",
        ut.last_active_at AS "lastActiveAt",
        ut.created_at AS "threadCreatedAt",
        CASE WHEN thread_user.id IS NULL THEN NULL ELSE json_build_object('id', thread_user.id, 'displayName', thread_user.display_name) END AS "threadAuthor",
        tm.body AS "messageBody",
        tm.ai_moderation_status AS "moderationStatus",
        tm.ai_moderation_language_code AS "moderationLanguageCode",
        tm.ai_moderation_reason AS "moderationReason",
        tm.created_at AS "messageCreatedAt",
        tm.updated_at AS "messageUpdatedAt",
        CASE WHEN message_user.id IS NULL THEN NULL ELSE json_build_object('id', message_user.id, 'displayName', message_user.display_name) END AS "messageAuthor"
      FROM updated_thread ut
      JOIN thread_messages tm ON tm.id = $1
      LEFT JOIN users thread_user ON thread_user.id = ut.created_by_user_id
      LEFT JOIN users message_user ON message_user.id = tm.created_by_user_id
    `,
    [messageId]
  );

  if (!row) {
    return;
  }

  await publishThreadMessageCreated(
    {
      id: row.threadId,
      channelId: row.channelId,
      title: row.title,
      languageCode: row.languageCode,
      tags: [],
      locked: row.locked,
      messageCount: row.messageCount,
      lastActiveAt: row.lastActiveAt,
      createdAt: row.threadCreatedAt,
      author: row.threadAuthor,
      reactionCounts: {},
      myReactions: [],
      followed: true,
      unread: true
    },
    {
      id: messageId,
      threadId: row.threadId,
      body: row.messageBody,
      moderationStatus: row.moderationStatus,
      moderationLanguageCode: row.moderationLanguageCode,
      moderationReason: row.moderationReason,
      createdAt: row.messageCreatedAt,
      updatedAt: row.messageUpdatedAt,
      author: row.messageAuthor,
      reactionCounts: {},
      myReactions: []
    }
  );
}

export async function publishThreadMessageModeration(
  threadId: number,
  messageId: number,
  message: ThreadMessage | null
): Promise<void> {
  const publicUsers = new Set([...(await recipientUserIds(threadId)), ...connectedUserIds()]);
  if (message?.author?.id) {
    publicUsers.delete(message.author.id);
  }

  await publishToUsers([...publicUsers], {
    type: 'thread.message.moderation',
    threadId,
    messageId,
    message: null
  });

  if (!message?.author?.id) {
    return;
  }

  await publishToUsers([message.author.id], {
    type: 'thread.message.moderation',
    threadId,
    messageId,
    message
  });
}

export async function publishThreadReactionUpdated(
  userId: number,
  message: Extract<ThreadWsMessage, { type: 'thread.reactions.updated' }>
): Promise<void> {
  const users = await recipientUserIds(message.threadId);
  for (const connectedUserId of connectedUserIds()) {
    if (!users.includes(connectedUserId)) {
      users.push(connectedUserId);
    }
  }
  if (!users.includes(userId)) {
    users.push(userId);
  }
  await publishToUsers(users, message);
}

export async function publishThreadReadUpdated(userId: number, threadId: number, unread: boolean, unreadCount: number): Promise<void> {
  await publishToUsers([userId], { type: 'thread.read.updated', threadId, unread, unreadCount });
}

export function setupThreadWebSocketServer(server: Server, logger: FastifyBaseLogger): void {
  server.on('upgrade', async (request, socket) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/threads/ws') {
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (request.method !== 'GET' || typeof key !== 'string' || key.trim() === '') {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    try {
      const ticket = url.searchParams.get('ticket') ?? '';
      const userId = await consumeThreadWebSocketTicket(ticket);
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

      addThreadClient(userId, socket);
      sendWsJson(socket, {
        type: 'threads.connected',
        followedUnreadCount: await followedUnreadCount(userId)
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
      logger.warn({ err: error }, 'Thread WebSocket upgrade failed');
      rejectUpgrade(socket, 500, 'Internal Server Error');
    }
  });
}
