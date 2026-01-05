
import React, { useState, useRef, useEffect } from 'react';
import { analyzePDFPage } from './services/geminiService';
import { generateDocx } from './services/docxService';
import { ProcessingStatus, ExtractedPage } from './types';
import ProgressBar from './components/ProgressBar';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ 
    step: 'idle', 
    progress: 0, 
    message: 'Sẵn sàng xử lý' 
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safely get pdfjsLib from window
  const getPdfJs = () => (window as any).pdfjsLib;

  useEffect(() => {
    const pdfjs = getPdfJs();
    if (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);

  const processPDF = async (file: File) => {
    try {
      const pdfjs = getPdfJs();
      if (!pdfjs) {
        throw new Error("Thư viện PDF.js chưa sẵn sàng. Vui lòng đợi vài giây và thử lại.");
      }

      setStatus({ step: 'rendering', progress: 0, message: 'Đang tải tệp PDF...' });
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const allExtractedPages: ExtractedPage[] = [];

      for (let i = 1; i <= totalPages; i++) {
        setStatus({ 
          step: 'analyzing', 
          progress: ((i - 1) / totalPages) * 100, 
          message: `Đang xử lý trang ${i}/${totalPages}...` 
        });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 }); // Higher scale for even better OCR clarity
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) throw new Error("Lỗi đồ họa: Không thể tạo canvas.");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        
        // Convert canvas to jpeg base64
        const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        
        const blocks = await analyzePDFPage(base64Image);
        allExtractedPages.push({ pageNumber: i, blocks });
      }

      setStatus({ step: 'generating', progress: 95, message: 'Đang tạo tệp Word...' });
      const docxBlob = await generateDocx(allExtractedPages);
      
      const url = window.URL.createObjectURL(docxBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace(/\.[^/.]+$/, "")}_Converted.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus({ step: 'completed', progress: 100, message: 'Chuyển đổi hoàn tất! Tệp đã được tải xuống.' });
    } catch (error: any) {
      console.error("App Processing Error:", error);
      setStatus({ step: 'error', progress: 0, message: error.message || "Đã xảy ra lỗi không xác định." });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPDF(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-50">
      <header className="w-full max-w-4xl text-center mb-10">
        <div className="inline-block p-2 px-4 bg-blue-100 text-blue-700 rounded-full text-sm font-bold mb-4">
          CÔNG NGHỆ GEMINI AI MỚI NHẤT
        </div>
        <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">AdminOCR Pro</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Số hóa văn bản PDF sang Word chuẩn Nghị định 30/2020/NĐ-CP. 
          Hỗ trợ nhận diện bảng biểu và chữ viết tay phức tạp.
        </p>
      </header>

      <main className="w-full max-w-2xl bg-white shadow-2xl rounded-3xl p-8 md:p-12 border border-slate-200">
        <div 
          className={`group relative border-4 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-300
            ${status.step === 'idle' || status.step === 'completed' || status.step === 'error' 
              ? 'border-blue-200 bg-blue-50/50 cursor-pointer hover:border-blue-400 hover:bg-blue-50' 
              : 'border-slate-200 bg-slate-50 opacity-60 pointer-events-none'}`}
          onClick={() => (status.step === 'idle' || status.step === 'completed' || status.step === 'error') && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="application/pdf" 
            className="hidden" 
          />
          
          <div className="w-20 h-20 bg-blue-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          <span className="text-2xl font-bold text-slate-800">Bắt đầu ngay</span>
          <p className="text-slate-500 text-center mt-3 font-medium">Kéo thả hoặc nhấp để chọn tệp PDF</p>
        </div>

        {status.step !== 'idle' && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProgressBar progress={status.progress} label={status.message} />
            
            {status.step === 'error' && (
              <div className="mt-6 bg-red-50 border border-red-100 text-red-700 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg">Đã xảy ra lỗi</span>
                  <span className="text-sm opacity-90">{status.message}</span>
                  <button 
                    onClick={() => setStatus({ step: 'idle', progress: 0, message: 'Sẵn sàng xử lý' })}
                    className="mt-3 text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-4 py-2 rounded-full w-fit hover:bg-red-700 transition-colors"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            )}

            {status.step === 'completed' && (
              <div className="mt-6 bg-emerald-50 border border-emerald-100 text-emerald-800 p-6 rounded-2xl flex flex-col items-center shadow-sm">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-md animate-bounce">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-bold text-xl mb-1 text-center">Xử lý hoàn tất!</span>
                <p className="text-sm text-emerald-600 mb-6 text-center">Tệp Word của bạn đã được tải xuống tự động.</p>
                <button 
                  onClick={() => setStatus({ step: 'idle', progress: 0, message: 'Sẵn sàng xử lý' })}
                  className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-900 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Chuyển đổi tệp khác
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <section className="mt-16 w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        {[
          { icon: '🎯', title: 'Siêu chính xác', desc: 'Nhận diện tốt cả PDF quét từ bản in mờ, nhiễu.' },
          { icon: '📏', title: 'Chuẩn 30/2020', desc: 'Tự động dàn trang theo quy định văn bản hành chính.' },
          { icon: '📊', title: 'Giữ cấu trúc bảng', desc: 'Chuyển đổi bảng biểu PDF thành bảng Word có thể chỉnh sửa.' },
          { icon: '🔒', title: 'Bảo mật tuyệt đối', desc: 'Dữ liệu được xử lý trực tiếp, không lưu trữ lâu dài.' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">{item.icon}</div>
            <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mt-16 py-8 text-slate-400 text-sm border-t border-slate-200 w-full text-center">
        &copy; 2024 AdminOCR Pro &bull; Giải pháp AI cho Văn phòng Hiện đại
      </footer>
    </div>
  );
};

export default App;
