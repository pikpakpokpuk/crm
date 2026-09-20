import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  async login(email: string, password: string) {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new AppError(400, 'Email and password are required');
    }
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
