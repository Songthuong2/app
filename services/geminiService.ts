
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedBlock, ContentType } from "../types";

export const analyzePDFPage = async (base64Image: string): Promise<ExtractedBlock[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: `Bạn là một chuyên gia số hóa văn bản hành chính Việt Nam (OCR). 
              Nhiệm vụ: Trích xuất TOÀN BỘ nội dung từ ảnh sang JSON.
              
              QUY TẮC QUAN TRỌNG:
              1. KHÔNG sử dụng nhiều ký tự tab (\t) liên tiếp hoặc khoảng trắng thừa để căn lề. Chỉ dùng 1 khoảng trắng duy nhất giữa các từ.
              2. Nhận diện bảng biểu chính xác vào cấu trúc 'rows'.
              3. Phân loại: 'header_top' (Quốc hiệu, cơ quan), 'text' (đoạn văn), 'table' (bảng), 'signature' (ký tên).
              4. 'content' là object chứa 'text' (nếu là văn bản) hoặc 'rows' (nếu là bảng).
              5. Đảm bảo JSON hợp lệ, không bị cắt ngang.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: Object.values(ContentType) },
              content: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  rows: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: { type: Type.STRING },
                          isBold: { type: Type.BOOLEAN }
                        }
                      }
                    }
                  }
                }
              },
              alignment: { type: Type.STRING, enum: ['left', 'center', 'right', 'justify'] },
              isBold: { type: Type.BOOLEAN },
              fontSize: { type: Type.NUMBER }
            },
            required: ['type', 'content']
          }
        }
      }
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("AI không trả về kết quả. Vui lòng thử lại.");
    }

    // Comprehensive sanitization for potential markdown wrappers or incomplete chunks
    let sanitizedText = text.trim();
    if (sanitizedText.startsWith('```json')) {
      sanitizedText = sanitizedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (sanitizedText.startsWith('```')) {
      sanitizedText = sanitizedText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    try {
      const rawBlocks = JSON.parse(sanitizedText);
      
      return rawBlocks.map((block: any) => {
        let content = block.content;
        // If content is the wrapper object {text: "..."} or {rows: [...]}, extract the value
        if (block.type === ContentType.TABLE) {
          content = block.content?.rows ? { rows: block.content.rows } : block.content;
        } else {
          content = typeof block.content === 'object' ? (block.content?.text || "") : block.content;
        }

        return {
          ...block,
          content
        };
      });
    } catch (parseError) {
      console.error("Failed to parse JSON:", sanitizedText);
      throw new Error("Lỗi cấu trúc dữ liệu từ AI. Có thể do tệp quá phức tạp. Vui lòng thử lại với trang ít nội dung hơn.");
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
