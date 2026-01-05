
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  VerticalAlign,
  PageNumber,
  NumberFormat
} from "docx";
import { ExtractedPage, ContentType, TableData } from "../types";

/**
 * Vietnamese Administrative Standard (Decree 30/2020/ND-CP):
 * - Font: Times New Roman
 * - Page: A4
 * - Margins: Top 20-25mm, Bottom 20-25mm, Left 30-35mm, Right 15-20mm
 */

const mmToTwips = (mm: number) => Math.floor(mm * 56.7);

export const generateDocx = async (pages: ExtractedPage[]): Promise<Blob> => {
  const children: any[] = [];

  pages.forEach((page, pageIdx) => {
    page.blocks.forEach((block) => {
      if (block.type === ContentType.TABLE) {
        const tableData = block.content as TableData;
        const rows = tableData.rows.map(row => 
          new TableRow({
            children: row.map(cell => 
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cell.text, bold: cell.isBold, font: "Times New Roman", size: 26 })]
                })],
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
              })
            )
          })
        );

        children.push(new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          }
        }));
        // Add spacing after table
        children.push(new Paragraph({ children: [] }));
      } else {
        const alignment = block.alignment === 'center' ? AlignmentType.CENTER :
                          block.alignment === 'right' ? AlignmentType.RIGHT :
                          block.alignment === 'justify' ? AlignmentType.BOTH : AlignmentType.LEFT;

        children.push(new Paragraph({
          alignment,
          spacing: { line: 360, before: 120, after: 120 }, // 1.5 line spacing approx
          children: [
            new TextRun({
              text: block.content as string,
              bold: block.isBold || block.type === ContentType.HEADER_TOP,
              font: "Times New Roman",
              size: block.fontSize ? block.fontSize * 2 : (block.type === ContentType.HEADER_TOP ? 28 : 26), // 13pt or 14pt
            }),
          ],
        }));
      }
    });

    // Add Page Break if not the last page
    if (pageIdx < pages.length - 1) {
      // Logic for explicit page breaks if needed, but 'docx' handles layout flow
    }
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: mmToTwips(20),
            bottom: mmToTwips(20),
            left: mmToTwips(30),
            right: mmToTwips(15),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
};
