import { Injectable, NotFoundException } from "@nestjs/common";
import { Feedback, SubmitFeedbackRequest } from "@sabsepehle/shared-types";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitFeedbackRequest): Promise<Feedback> {
    const message = await this.prisma.message.findUnique({ where: { id: dto.messageId } });
    if (!message) throw new NotFoundException(`Message ${dto.messageId} not found`);

    const feedback = await this.prisma.feedback.upsert({
      where: { messageId: dto.messageId },
      create: { messageId: dto.messageId, rating: dto.rating, comment: dto.comment ?? null },
      update: { rating: dto.rating, comment: dto.comment ?? null },
    });

    return {
      id: feedback.id,
      messageId: feedback.messageId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}
