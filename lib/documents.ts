import JSZip from "jszip";
import mammoth from "mammoth";
import { AppError } from "./validation";
import { chunkText } from "./retrieval";
export const MAX_FILE = 3 * 1024 * 1024;
export function validateFile(name: string, size: number) {
  const ext = name.toLowerCase().split(".").pop();
  if (!["pdf", "docx", "txt", "csv"].includes(ext || ""))
    throw new AppError(400, "Upload a PDF, DOCX, TXT or CSV file.");
  if (!size || size > MAX_FILE)
    throw new AppError(400, "Files must be between 1 byte and 3 MB.");
  return ext!;
}
export async function extractFile(name: string, bytes: Buffer) {
  const ext = validateFile(name, bytes.length);
  let text = "";
  if (ext === "docx") {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new AppError(400, "Invalid DOCX file.");
    const zip = await JSZip.loadAsync(bytes);
    let total = 0;
    for (const f of Object.values(zip.files)) {
      total += (f as any)._data?.uncompressedSize || 0;
    }
    if (total > 20 * 1024 * 1024 || Object.keys(zip.files).length > 1500)
      throw new AppError(400, "Document is too complex to process safely.");
    if (!zip.file("word/document.xml"))
      throw new AppError(400, "Invalid Word document.");
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  } else if (ext === "pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new AppError(400, "Invalid PDF file.");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      if (result.total > 100)
        throw new AppError(
          400,
          "Please split PDFs into files of at most 100 pages.",
        );
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000"))
      throw new AppError(400, "Upload a UTF-8 text file.");
  }
  if (text.length > 150000)
    throw new AppError(
      400,
      "Please split the document into smaller files (150,000 characters maximum).",
    );
  if (text.trim().length < 20)
    throw new AppError(
      400,
      "No readable text found. Scanned PDFs require OCR before upload.",
    );
  return chunkText(text);
}
