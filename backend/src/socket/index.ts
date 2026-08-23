import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { pool } from '../db/pool';
import { env } from '../config/env';
import { showRoom } from '../config/constants';
import jwt from 'jsonwebtoken';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
        if (env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    let userId: string | null = null;

    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        userId = payload.sub;
      } catch {
        // Anonymous connection — still allowed to view seat maps
      }
    }

    /**
     * Join a show room to receive real-time seat map updates.
     * On join, the server sends a full seat map snapshot so reconnecting
     * clients always reconcile to the true current state (not stale cache).
     */
    socket.on('join-show', async (showId: string) => {
      if (!showId) return;

      // Leave previous show rooms
      const currentRooms = Array.from(socket.rooms).filter((r: string) => r.startsWith('show:'));
      for (const room of currentRooms) {
        socket.leave(room);
      }

      socket.join(showRoom(showId));

      try {
        // Send full seat map snapshot for reconciliation
        const rows = await pool.query(
          `SELECT ss.id as show_seat_id, ss.seat_id, ss.status,
                  s.row_label, s.seat_number, s.is_aisle,
                  sc.id as category_id, sc.name as category_name, sc.color_hex,
                  ssp.price,
                  CASE WHEN h.customer_id = $2 THEN true ELSE false END as held_by_me,
                  h.expires_at as hold_expires_at
           FROM show_seats ss
           JOIN seats s ON s.id = ss.seat_id
           JOIN seat_categories sc ON sc.id = s.category_id
           LEFT JOIN show_seat_prices ssp ON ssp.show_id = ss.show_id AND ssp.category_id = sc.id
           LEFT JOIN holds h ON h.show_seat_id = ss.id
           WHERE ss.show_id = $1
           ORDER BY s.row_label, s.seat_number`,
          [showId, userId]
        );

        socket.emit('seat-map:snapshot', { showId, seats: rows.rows });
      } catch (err) {
        console.error('[socket] Error sending seat map snapshot:', err);
      }
    });

    socket.on('leave-show', (showId: string) => {
      socket.leave(showRoom(showId));
    });

    socket.on('disconnect', () => {
      // Cleanup handled automatically by Socket.io room management
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.');
  return io;
}
