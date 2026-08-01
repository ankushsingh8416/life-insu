import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export interface ExtractedContent {
  title: string;
  text: string;
}

@Injectable()
export class ContentExtractorService {
  private readonly logger = new Logger(ContentExtractorService.name);

  async extractFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractedContent> {
    if (mimeType === "application/pdf") {
      const result = await pdfParse(buffer);
      return { title: fileName, text: result.text };
    }
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return { title: fileName, text: result.value };
    }
    if (mimeType === "text/csv") {
      return { title: fileName, text: buffer.toString("utf-8") };
    }
    // text/plain and anything else falls back to raw UTF-8
    return { title: fileName, text: buffer.toString("utf-8") };
  }

  async extractFromUrl(url: string): Promise<ExtractedContent> {
    const response = await fetch(url, {
      headers: { "User-Agent": "SabsePehleAI-KnowledgeCrawler/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }
    const html = await response.text();
    return this.extractFromHtml(html, url);
  }

  extractFromHtml(html: string, url: string): ExtractedContent {
    const $ = cheerio.load(html);
    $("script, style, noscript, nav, footer, header, iframe, svg").remove();

    const title = $("title").first().text().trim() || url;
    const mainContent =
      $("main").text() || $("article").text() || $("body").text() || "";

    const text = mainContent.replace(/\s+/g, " ").trim();
    return { title, text };
  }
}
