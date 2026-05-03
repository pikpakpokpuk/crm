import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' },
    );

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async createUser(data: { email: string; password: string; name: string; role?: 'ADMIN' | 'EMPLOYEE' }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: { email: data.email, passwordHash, name: data.name, role: data.role ?? 'EMPLOYEE' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  }
}

export default new AuthService();
