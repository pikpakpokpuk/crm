import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  userId?: string | null;
}

const USER_SELECT = { id: true, name: true, calendarColor: true } satisfies Prisma.UserSelect;

export class CalendarService {
  async getEvents(start: Date, end: Date, userIds?: string[]) {
    const userFilter = userIds && userIds.length > 0 ? { in: userIds } : undefined;

    const jobs = await prisma.job.findMany({
      where: {
        scheduledStart: { lte: end },
        scheduledEnd: { gte: start },
        ...(userFilter ? { crew: { some: { userId: userFilter } } } : {}),
      },
      include: {
        crew: { include: { user: { select: USER_SELECT } } },
      },
    });

    const jobEvents = jobs.flatMap((job) =>
      job.crew.map((c) => ({
        type: 'job' as const,
        jobId: job.id,
        title: job.description,
        start: job.scheduledStart,
        end: job.scheduledEnd,
        userId: c.user.id,
        userName: c.user.name,
        color: c.user.calendarColor,
      }))
    );

    const manual = await prisma.calendarEvent.findMany({
      where: {
        startAt: { lte: end },
        endAt: { gte: start },
        ...(userFilter ? { OR: [{ userId: userFilter }, { userId: null }] } : {}),
      },
      include: { user: { select: USER_SELECT } },
    });

    const manualEvents = manual.map((e) => ({
      type: 'manual' as const,
      id: e.id,
      title: e.title,
      description: e.description,
      start: e.startAt,
      end: e.endAt,
      allDay: e.allDay,
      userId: e.user?.id ?? null,
      userName: e.user?.name ?? null,
      color: e.user?.calendarColor ?? '#9ca3af',
    }));

    return [...jobEvents, ...manualEvents];
  }

  async createEvent(data: CalendarEventInput, createdById: string) {
    return prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        allDay: data.allDay ?? false,
        userId: data.userId ?? null,
        createdById,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async updateEvent(id: string, data: Partial<CalendarEventInput>) {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Event not found');
    return prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.startAt !== undefined ? { startAt: new Date(data.startAt) } : {}),
        ...(data.endAt !== undefined ? { endAt: new Date(data.endAt) } : {}),
        ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
        ...(data.userId !== undefined ? { userId: data.userId } : {}),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async deleteEvent(id: string, requesterId: string, isAdmin: boolean) {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Event not found');
    if (!isAdmin && existing.createdById !== requesterId) {
      throw new AppError(403, 'Only the creator or an admin can delete this event');
    }
    await prisma.calendarEvent.delete({ where: { id } });
  }
}

export default new CalendarService();
