import { db } from '@/lib/db';

export type DeletedProjectSummary = {
  projectId: string;
  bidFilesDeleted: number;
  analysesDeleted: number;
  estimatesDeleted: number;
  estimateSendsDeleted: number;
  estimateOpenEventsDeleted: number;
  estimateNotificationEventsDeleted: number;
  estimateActivityEventsDeleted: number;
};

export async function deleteProjectDeep(projectId: string): Promise<DeletedProjectSummary | null> {
  const existingProject = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!existingProject) {
    return null;
  }

  return db.$transaction(async (tx) => {
    const estimates = await tx.estimate.findMany({
      where: { projectId },
      select: { id: true },
    });
    const estimateIds = estimates.map((estimate) => estimate.id);

    const sends = estimateIds.length
      ? await tx.estimateSend.findMany({
          where: { estimateId: { in: estimateIds } },
          select: { id: true },
        })
      : [];
    const sendIds = sends.map((send) => send.id);

    const openEvents = sendIds.length
      ? await tx.estimateOpenEvent.findMany({
          where: { estimateSendId: { in: sendIds } },
          select: { id: true },
        })
      : [];
    const openEventIds = openEvents.map((event) => event.id);

    let estimateNotificationEventsDeleted = 0;
    if (openEventIds.length) {
      const result = await tx.estimateNotificationEvent.deleteMany({
        where: { estimateOpenEventId: { in: openEventIds } },
      });
      estimateNotificationEventsDeleted += result.count;
    }
    if (sendIds.length) {
      const result = await tx.estimateNotificationEvent.deleteMany({
        where: { estimateSendId: { in: sendIds } },
      });
      estimateNotificationEventsDeleted += result.count;
    }

    const estimateOpenEventsDeleted = openEventIds.length
      ? (
          await tx.estimateOpenEvent.deleteMany({
            where: { id: { in: openEventIds } },
          })
        ).count
      : 0;

    let estimateActivityEventsDeleted = 0;
    if (sendIds.length) {
      const result = await tx.estimateActivityEvent.deleteMany({
        where: { estimateSendId: { in: sendIds } },
      });
      estimateActivityEventsDeleted += result.count;
    }
    if (estimateIds.length) {
      const result = await tx.estimateActivityEvent.deleteMany({
        where: { estimateId: { in: estimateIds } },
      });
      estimateActivityEventsDeleted += result.count;
    }

    const estimateSendsDeleted = sendIds.length
      ? (
          await tx.estimateSend.deleteMany({
            where: { id: { in: sendIds } },
          })
        ).count
      : 0;

    const estimatesDeleted = estimateIds.length
      ? (
          await tx.estimate.deleteMany({
            where: { id: { in: estimateIds } },
          })
        ).count
      : 0;

    const analysesDeleted = (
      await tx.analysis.deleteMany({
        where: { projectId },
      })
    ).count;

    const bidFilesDeleted = (
      await tx.bidFile.deleteMany({
        where: { projectId },
      })
    ).count;

    await tx.project.delete({
      where: { id: projectId },
    });

    return {
      projectId,
      bidFilesDeleted,
      analysesDeleted,
      estimatesDeleted,
      estimateSendsDeleted,
      estimateOpenEventsDeleted,
      estimateNotificationEventsDeleted,
      estimateActivityEventsDeleted,
    };
  });
}
