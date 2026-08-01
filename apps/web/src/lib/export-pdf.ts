import { ChatMessage } from "@sabsepehle/shared-types";

const PAGE_MARGIN = 48;
const LINE_HEIGHT = 16;
const FONT_SIZE = 11;

// jsPDF is only needed when the user actually clicks "Export" — load it on
// demand instead of bundling it into the initial chat page payload.
export async function exportChatToPdf(messages: ChatMessage[], title = "Sabse Pehle AI — Conversation") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN * 2;

  let y = PAGE_MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, PAGE_MARGIN, y);
  y += LINE_HEIGHT * 1.5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleString()}`, PAGE_MARGIN, y);
  doc.setTextColor(0);
  y += LINE_HEIGHT * 1.5;

  for (const message of messages) {
    const speaker = message.role === "user" ? "You" : "Sabse Pehle AI";
    const timestamp = new Date(message.createdAt).toLocaleString();

    if (y > pageHeight - PAGE_MARGIN * 2) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    doc.setFontSize(FONT_SIZE);
    doc.setFont("helvetica", "bold");
    doc.text(`${speaker}  ·  ${timestamp}`, PAGE_MARGIN, y);
    y += LINE_HEIGHT;

    doc.setFont("helvetica", "normal");
    const lines: string[] = doc.splitTextToSize(stripMarkdown(message.content), usableWidth);
    for (const line of lines) {
      if (y > pageHeight - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      doc.text(line, PAGE_MARGIN, y);
      y += LINE_HEIGHT;
    }

    if (message.citations.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(90);
      for (const citation of message.citations) {
        if (y > pageHeight - PAGE_MARGIN) {
          doc.addPage();
          y = PAGE_MARGIN;
        }
        doc.text(`Source: ${citation.title}`, PAGE_MARGIN + 12, y);
        y += LINE_HEIGHT * 0.85;
      }
      doc.setTextColor(0);
      doc.setFontSize(FONT_SIZE);
    }

    y += LINE_HEIGHT * 0.5;
  }

  doc.save(`sabse-pehle-ai-chat-${Date.now()}.pdf`);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ""))
    .replace(/[#*_`>]/g, "")
    .trim();
}
