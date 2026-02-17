import 'express';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUserId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        role: string;
        email: string;
        name: string | null;
      };
    }
  }
}
