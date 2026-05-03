import type { Request } from 'express';
import type { User } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: Pick<User, 'id' | 'email' | 'role' | 'name'>;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface JobsQuery extends PaginationQuery {
  status?: string;
  priority?: string;
  customerId?: string;
  assignedToId?: string;
  search?: string;
}
