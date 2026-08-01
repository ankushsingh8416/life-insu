import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { SubmitFeedbackRequest, SubmitFeedbackRequestSchema } from "@sabsepehle/shared-types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Public } from "../common/decorators/public.decorator";
import { FeedbackService } from "./feedback.service";

@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Public()
  @Post()
  @UsePipes(new ZodValidationPipe(SubmitFeedbackRequestSchema))
  async submit(@Body() dto: SubmitFeedbackRequest) {
    return this.feedbackService.submit(dto);
  }
}
