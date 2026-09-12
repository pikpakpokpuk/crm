import prisma from '../prisma/client';

export async function logActivity(
  jobId: string,
  userId: string | null,
  action: string,
  details?: string,
) {
  try {
    await prisma.jobActivityLog.create({
      data: { jobId, userId, action, details: details ?? null },
    });
  } catch {
    // Never throw — logging must not break the main operation
  }
}

export async function getActivityLog(jobId: string) {
  return prisma.jobActivityLog.findMany({
    where: { jobId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true } } },
  });
}
