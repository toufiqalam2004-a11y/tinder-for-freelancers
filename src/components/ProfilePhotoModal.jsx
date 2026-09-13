import React, { useState, useRef } from 'react';
import { Camera, Trash2, X, Upload, Check, AlertCircle } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { validateProfileImage, processImageFile } from '../utils/imageUtils.js';
import toast from 'react-hot-toast';

export default function ProfilePhotoModal({
  isOpen,
  onClose,
  currentPhoto = null,
  userInitial = 'TF',
  userName = 'User',
  onSave,
  onRemove,
}) {
  const fileInputRef = useRef(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so user can pick the same file again if desired
    e.target.value = '';

    const validation = validateProfileImage(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    try {
      setIsProcessing(true);
      const processedUrl = await processImageFile(file);
      setPreviewPhoto(processedUrl);
      setImgError(false);
    } catch (err) {
      toast.error(err.message || 'Failed to process image. Please try another file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (!previewPhoto) return;
    if (onSave) {
      onSave(previewPhoto);
    }
    toast.success('Profile photo updated.');
    setPreviewPhoto(null);
    onClose();
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
    toast.success('Profile photo removed.');
    setPreviewPhoto(null);
    onClose();
  };

  const handleCancelPreview = () => {
    setPreviewPhoto(null);
  };

  const displayPhoto = previewPhoto || currentPhoto;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Photo">
      <div className="flex flex-col items-center py-2 text-center space-y-4">
        {/* Avatar Display */}
        <div className="relative group">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-surface-hover shadow-xl flex items-center justify-center bg-surface">
            {displayPhoto && !imgError ? (
              <img
                src={displayPhoto}
                alt={userName}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="gradient-primary w-full h-full flex items-center justify-center text-white text-4xl font-extrabold">
                {userInitial}
              </div>
            )}
          </div>

          {/* Quick upload trigger button on avatar */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="absolute bottom-1 right-1 p-2 rounded-full bg-primary text-white hover:bg-primary-dark shadow-md border-2 border-surface transition-transform hover:scale-105"
            title="Upload photo"
            aria-label="Upload photo"
          >
            <Camera size={16} />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          className="hidden"
          onChange={handleFileSelect}
        />

        {previewPhoto ? (
          /* Preview state: confirm, change, remove, or continue without photo */
          <div className="w-full space-y-3 pt-2">
            <p className="text-xs text-text-secondary">
              Review your photo preview before applying.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleSave}
                icon={<Check size={14} />}
              >
                Use This Photo
              </Button>
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload size={13} />}
                >
                  Change Photo
                </Button>
                {currentPhoto && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={handleRemove}
                    icon={<Trash2 size={13} />}
                  >
                    Remove Photo
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviewPhoto(null);
                    onClose();
                  }}
                >
                  Continue without photo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal state: Add Profile Photo / Change Photo, Remove Photo, and Continue without photo */
          <div className="w-full space-y-2 pt-2">
            <p className="text-xs text-text-muted">
              Supported formats: JPG, PNG, or WEBP (Max 5 MB)
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => fileInputRef.current?.click()}
                loading={isProcessing}
                icon={<Upload size={14} />}
              >
                {currentPhoto ? 'Change Photo' : 'Add Profile Photo'}
              </Button>

              {currentPhoto && (
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={handleRemove}
                  icon={<Trash2 size={14} />}
                >
                  Remove Photo
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={onClose}
              >
                Continue without photo
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
