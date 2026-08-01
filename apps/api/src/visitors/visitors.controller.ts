import { Body, Controller, Ip, Post, UsePipes, Headers } from "@nestjs/common";
import { RegisterVisitorRequest, RegisterVisitorRequestSchema } from "@sabsepehle/shared-types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Public } from "../common/decorators/public.decorator";
import { VisitorsService } from "./visitors.service";

@Controller("visitors")
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Public()
  @Post("register")
  @UsePipes(new ZodValidationPipe(RegisterVisitorRequestSchema))
  async register(
    @Body() dto: RegisterVisitorRequest,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
  ) {
    return this.visitorsService.registerOrTouch(dto, { ip, userAgent });
  }
}
