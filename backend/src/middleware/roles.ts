import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants';

/**
 * Role guard factory.
 * Usage: router.get('/admin/venues', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}
