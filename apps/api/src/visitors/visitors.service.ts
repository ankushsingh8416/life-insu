import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { RegisterVisitorRequest, Visitor } from "@sabsepehle/shared-types";
import { PrismaService } from "../common/prisma/prisma.service";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerOrTouch(dto: RegisterVisitorRequest, meta: RequestMeta): Promise<Visitor> {
    const id = dto.visitorId ?? randomUUID();
    const { browser, os, device } = parseUserAgent(meta.userAgent);

    const visitor = await this.prisma.visitor.upsert({
      where: { id },
      create: {
        id,
        language: dto.language ?? null,
        browser,
        os,
        device,
      },
      update: {
        language: dto.language ?? undefined,
        browser,
        os,
        device,
      },
    });

    return {
      id: visitor.id,
      language: visitor.language,
      country: visitor.country,
      city: visitor.city,
      device: visitor.device,
      browser: visitor.browser,
      os: visitor.os,
      firstSeenAt: visitor.firstSeenAt.toISOString(),
      lastSeenAt: visitor.lastSeenAt.toISOString(),
    };
  }
}

function parseUserAgent(userAgent?: string): {
  browser: string | null;
  os: string | null;
  device: string | null;
} {
  if (!userAgent) return { browser: null, os: null, device: null };

  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /chrome/i.test(userAgent)
      ? "Chrome"
      : /firefox/i.test(userAgent)
        ? "Firefox"
        : /safari/i.test(userAgent)
          ? "Safari"
          : "Other";

  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /android/i.test(userAgent)
      ? "Android"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "iOS"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Other";

  const device = /mobile/i.test(userAgent) ? "Mobile" : /tablet|ipad/i.test(userAgent) ? "Tablet" : "Desktop";

  return { browser, os, device };
}
