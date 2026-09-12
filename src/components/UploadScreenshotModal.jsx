import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, UploadCloud, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const SAMPLE_SCREENSHOT_DATA = {
  fileName: 'facebook_group_hiring_post.png',
  extractedText:
    '🔥 [HIRING] Full-time / Freelance YouTube Video Editor for tech review channel with 350k subscribers. Must have 2+ years of experience with Adobe Premiere Pro and After Effects. Pacing, audio design, and retention-focused edits. Remote. Budget: $500 per video (2 videos/week). DM with portfolio link.',
  author: 'TechStudio Media (Group Post)',
};

export default function UploadScreenshotModal({
  isOpen,
  onClose,
  onImport,
  source,
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracted, setIsExtracted] = useState(false);

  const handleUseSample = () => {
    setSelectedImage(SAMPLE_SCREENSHOT_DATA.fileName);
    setIsProcessing(true);

    setTimeout(() => {
      setOcrText(SAMPLE_SCREENSHOT_DATA.extractedText);
      setIsProcessing(false);
      setIsExtracted(true);
    }, 600);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file.name);
    setIsProcessing(true);

    // Simulate OCR text extraction for user-uploaded image
    setTimeout(() => {
      setOcrText(
        `[Extracted from ${file.name}]: Looking for an experienced Freelance Video Editor needed for weekly YouTube videos. Remote work. Premiere Pro / Motion Graphics required. Paid gig ($40/hr). Contact poster.`
      );
      setIsProcessing(false);
      setIsExtracted(true);
    }, 700);
  };

  const handleConfirmImport = () => {
    if (!ocrText) return;

    onImport({
      source,
      postUrl: source?.groupUrl || 'https://facebook.com',
      postText: ocrText,
      author: 'Facebook Member (via Screenshot)',
    });

    // Reset & close
    setSelectedImage(null);
    setOcrText('');
    setIsExtracted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Screenshot">
      <p className="text-xs text-text-secondary -mt-2 mb-4 leading-relaxed">
        Upload a screenshot of any public Facebook group hiring post. OCR extraction will parse the post text and run it through the job detection pipeline.
      </p>

      {/* Preset sample button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleUseSample}
          className="w-full flex items-center justify-between text-xs bg-primary/10 border border-primary/20 text-primary-light hover:bg-primary/20 px-3 py-2.5 rounded-xl transition-colors font-medium"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} />
            Try Sample Post Screenshot (YouTube Editor)
          </span>
          <span className="text-[11px] bg-primary/20 px-2 py-0.5 rounded">1-Click</span>
        </button>
      </div>

      {/* Upload Dropzone */}
      <label className="block cursor-pointer">
        <div className="border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center text-center hover:bg-surface-hover/70 transition-colors">
          <UploadCloud size={28} className="text-text-muted mb-2" />
          <p className="text-sm font-medium text-text-primary">
            {selectedImage ? selectedImage : 'Click or drop screenshot here'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">PNG, JPG, or WEBP</p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {/* OCR processing state */}
      {isProcessing && (
        <div className="mt-4 p-3 bg-surface-hover rounded-xl text-center">
          <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
          <p className="text-xs text-text-secondary">Extracting text via OCR pipeline...</p>
        </div>
      )}

      {/* Extracted preview */}
      {isExtracted && ocrText && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Text Extracted Successfully:</span>
          </div>
          <div className="bg-surface-hover/80 border border-border rounded-xl p-3 text-xs text-text-secondary leading-relaxed font-sans max-h-36 overflow-y-auto">
            {ocrText}
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              fullWidth
              onClick={handleConfirmImport}
            >
              <Sparkles size={16} className="mr-1.5" />
              Detect Job & Add to Feed
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
