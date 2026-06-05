import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: string;
      supportLevel?: string | null;
    };
    impersonatedBy?: string | null;
    impersonationLevel?: 'view' | 'full' | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    supportLevel?: string | null;
    impersonatedBy?: string | null;
    impersonationLevel?: 'view' | 'full' | null;
    impExp?: number | null;
  }
}
