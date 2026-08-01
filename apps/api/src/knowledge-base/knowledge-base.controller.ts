import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CreateKnowledgeUrlRequest,
  CreateKnowledgeUrlRequestSchema,
  ListKnowledgeDocumentsQuery,
  ListKnowledgeDocumentsQuerySchema,
} from "@sabsepehle/shared-types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { KnowledgeBaseService } from "./knowledge-base.service";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

@Controller("kb/documents")
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    return this.knowledgeBaseService.createFromUpload(file);
  }

  @Post("url")
  @UsePipes(new ZodValidationPipe(CreateKnowledgeUrlRequestSchema))
  async fromUrl(@Body() dto: CreateKnowledgeUrlRequest) {
    return this.knowledgeBaseService.createFromUrl(dto);
  }

  @Get()
  @UsePipes(new ZodValidationPipe(ListKnowledgeDocumentsQuerySchema))
  async list(@Query() query: ListKnowledgeDocumentsQuery) {
    return this.knowledgeBaseService.list(query);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.knowledgeBaseService.getById(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.knowledgeBaseService.remove(id);
    return { deleted: true };
  }

  @Post(":id/reindex")
  async reindex(@Param("id") id: string) {
    return this.knowledgeBaseService.reindex(id);
  }
}
