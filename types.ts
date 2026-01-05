
export enum ContentType {
  TEXT = 'text',
  TABLE = 'table',
  HEADER_TOP = 'header_top', // For "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" etc.
  SIGNATURE = 'signature'
}

export interface TableCell {
  text: string;
  isBold?: boolean;
}

export interface TableData {
  rows: TableCell[][];
}

export interface ExtractedBlock {
  type: ContentType;
  content: string | TableData;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isBold?: boolean;
  fontSize?: number;
}

export interface ExtractedPage {
  pageNumber: number;
  blocks: ExtractedBlock[];
}

export interface ProcessingStatus {
  step: 'idle' | 'rendering' | 'analyzing' | 'generating' | 'completed' | 'error';
  progress: number;
  message: string;
}
