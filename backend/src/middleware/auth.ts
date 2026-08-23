import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../config/constants';

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches decoded payload to req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/** Optional auth — attaches user if token is valid, does not fail if absent */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as JwtPayload;
      req.user = payload;
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
}
