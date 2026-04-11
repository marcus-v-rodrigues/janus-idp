import 'express';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUserSub?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        sub: string;
        email: string;
        name: string | null;
      };
    }
  }
}

export {};
