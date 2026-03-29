
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export type SupportedFileType = 'image' | 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt' | 'text' | 'binary';

/**
 * Detect file type from a File object.
 */
export const detectFileType = (file: File): SupportedFileType => {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // Images
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) {
    return 'image';
  }

  // PDF
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }

  // DOCX (Word - modern)
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'docx';
  }

  // DOC (Word - legacy)
  if (
    type === 'application/msword' ||
    name.endsWith('.doc')
  ) {
    return 'doc';
  }

  // PPTX (PowerPoint - modern)
  if (
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx')
  ) {
    return 'pptx';
  }

  // PPT (PowerPoint - legacy)
  if (
    type === 'application/vnd.ms-powerpoint' ||
    name.endsWith('.ppt')
  ) {
    return 'ppt';
  }

  // Plain text, code files, markdown, CSV, JSON, etc.
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    /\.(txt|md|csv|json|xml|html|css|js|ts|tsx|jsx|py|java|c|cpp|h|rb|go|rs|sh|yaml|yml|toml|ini|cfg|log|sql|env)$/.test(name)
  ) {
    return 'text';
  }

  return 'binary';
};

/**
 * Get a user-friendly label for the file type.
 */
export const getFileTypeLabel = (fileType: SupportedFileType): string => {
  switch (fileType) {
    case 'image': return 'Image';
    case 'pdf': return 'PDF Document';
    case 'docx': return 'Word Document';
    case 'doc': return 'Word Document (Legacy)';
    case 'pptx': return 'PowerPoint Presentation';
    case 'ppt': return 'PowerPoint (Legacy)';
    case 'text': return 'Text File';
    case 'binary': return 'Binary File';
  }
};

/**
 * Extract text content from a PDF file.
 */
const extractPdfText = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  const maxPages = Math.min(pdf.numPages, 50); // Cap at 50 pages to avoid huge payloads
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    if (pageText.trim()) {
      textParts.push(`[Page ${i}]\n${pageText}`);
    }
  }

  if (pdf.numPages > maxPages) {
    textParts.push(`\n[... ${pdf.numPages - maxPages} more pages not shown ...]`);
  }

  return textParts.join('\n\n') || 'Could not extract text from this PDF.';
};

/**
 * Extract text content from a DOCX file.
 */
const extractDocxText = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || 'Could not extract text from this document.';
};

/**
 * Extract text content from a plain text file.
 */
const extractTextContent = async (file: File): Promise<string> => {
  return await file.text();
};

/**
 * Extract text from a PPTX file (ZIP of XML slides).
 */
const extractPptxText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    
    // PPTX is a ZIP archive; we'll use the browser's DecompressionStream if available,
    // otherwise fall back to basic XML extraction from raw bytes
    const bytes = new Uint8Array(arrayBuffer);
    const textParts: string[] = [];
    
    // Find and extract XML content from slide files within the ZIP
    // PPTX slides are in ppt/slides/slide*.xml
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(bytes);
    
    // Extract text between <a:t> tags (PowerPoint text elements)
    const textMatches = rawText.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches && textMatches.length > 0) {
      const slideTexts = textMatches.map(m => m.replace(/<\/?a:t>/g, '').trim()).filter(t => t.length > 0);
      
      // Group consecutive text elements as slide content
      let currentSlide = 1;
      let slideContent: string[] = [];
      for (const text of slideTexts) {
        slideContent.push(text);
      }
      
      if (slideContent.length > 0) {
        textParts.push(slideContent.join(' '));
      }
    }
    
    if (textParts.length === 0) {
      // Fallback: try to extract any readable text between XML tags
      const anyText = rawText.match(/>([^<]{2,})</g);
      if (anyText) {
        const readable = anyText
          .map(m => m.slice(1).trim())
          .filter(t => t.length > 2 && !/^[\x00-\x1f]+$/.test(t) && !t.includes('xml') && !t.includes('xmlns'));
        if (readable.length > 0) {
          textParts.push(readable.join(' '));
        }
      }
    }
    
    return textParts.join('\n\n') || 'Could not extract text from this PowerPoint file.';
  } catch (err) {
    console.error('PPTX extraction error:', err);
    return 'Could not extract text from this PowerPoint file. The file may be corrupted or use an unsupported format.';
  }
};

/**
 * Handle legacy binary Office formats (.doc, .ppt) by extracting readable text.
 */
const extractLegacyOfficeText = async (file: File, format: string): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(bytes);
    
    // Extract printable ASCII strings (minimum 4 chars) from the binary
    const printableStrings: string[] = [];
    let current = '';
    for (let i = 0; i < rawText.length; i++) {
      const code = rawText.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        current += rawText[i];
      } else if (code === 10 || code === 13 || code === 9) {
        current += ' ';
      } else {
        if (current.trim().length >= 4) {
          printableStrings.push(current.trim());
        }
        current = '';
      }
    }
    if (current.trim().length >= 4) {
      printableStrings.push(current.trim());
    }
    
    // Filter out binary noise (strings that look like metadata/binary)
    const readable = printableStrings.filter(s => {
      const alphaRatio = (s.match(/[a-zA-Z\s]/g) || []).length / s.length;
      return alphaRatio > 0.5 && s.length > 5;
    });
    
    if (readable.length > 0) {
      return `[Extracted from legacy ${format} format - some formatting may be lost]\n\n${readable.join('\n')}`;
    }
    
    return `This is a legacy ${format} file. For best results, please convert it to ${format === '.doc' ? '.docx' : '.pptx'} format and re-upload.`;
  } catch {
    return `Could not read this legacy ${format} file. Please convert it to ${format === '.doc' ? '.docx' : '.pptx'} format and try again.`;
  }
};

/**
 * Parse a file and extract its text content for analysis.
 * Returns the extracted text and metadata.
 */
export const parseFile = async (file: File): Promise<{
  text: string;
  fileType: SupportedFileType;
  fileName: string;
  truncated: boolean;
}> => {
  const fileType = detectFileType(file);
  const fileName = file.name;
  let text = '';
  let truncated = false;

  switch (fileType) {
    case 'pdf':
      text = await extractPdfText(file);
      break;
    case 'docx':
      text = await extractDocxText(file);
      break;
    case 'doc':
      text = await extractLegacyOfficeText(file, '.doc');
      break;
    case 'pptx':
      text = await extractPptxText(file);
      break;
    case 'ppt':
      text = await extractLegacyOfficeText(file, '.ppt');
      break;
    case 'text':
      text = await extractTextContent(file);
      break;
    case 'image':
      // Images are handled separately via vision model
      text = '';
      break;
    case 'binary':
      // For unknown/binary files, try to read as text first
      try {
        const rawText = await file.text();
        // Check if it looks like valid text (low ratio of non-printable chars)
        const nonPrintable = rawText.slice(0, 1000).split('').filter(c => {
          const code = c.charCodeAt(0);
          return code < 32 && code !== 9 && code !== 10 && code !== 13;
        }).length;
        if (nonPrintable < 50) {
          // Looks like text content
          text = rawText;
        } else {
          // Truly binary -- provide file metadata for AI to acknowledge
          const sizeKB = (file.size / 1024).toFixed(1);
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          text = `[Binary file uploaded]\nFile name: ${file.name}\nFile type: ${file.type || 'unknown'}\nFile size: ${parseFloat(sizeMB) > 1 ? sizeMB + ' MB' : sizeKB + ' KB'}\n\nThis is a binary file and its raw content cannot be displayed as text. Please describe what you would like to know about this file.`;
        }
      } catch {
        const sizeKB = (file.size / 1024).toFixed(1);
        text = `[File uploaded]\nFile name: ${file.name}\nFile type: ${file.type || 'unknown'}\nFile size: ${sizeKB} KB\n\nCould not read file content. Please describe what you need help with regarding this file.`;
      }
      break;
  }

  // Truncate very large text to avoid exceeding token limits
  const MAX_CHARS = 15000;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + `\n\n[... Content truncated at ${MAX_CHARS} characters. Original file: ${(text.length / 1000).toFixed(0)}K chars ...]`;
    truncated = true;
  }

  return { text, fileType, fileName, truncated };
};
