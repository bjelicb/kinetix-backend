export interface JwtPayload {
  sub: string; // User._id
  email: string;
  role: string; // 'TRAINER' | 'CLIENT' | 'ADMIN'
  iat?: number;
  exp?: number;
}

