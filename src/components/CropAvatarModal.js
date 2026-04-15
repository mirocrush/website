import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

/* ── Canvas helper: converts croppedAreaPixels → Blob ───────────────────── */
async function cropImageToBlob(imageSrc, croppedAreaPixels, rotation = 0) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = imageSrc;
  });

  const canvas  = document.createElement('canvas');
  const size    = Math.max(croppedAreaPixels.width, croppedAreaPixels.height);
  canvas.width  = size;
  canvas.height = size;
  const ctx     = canvas.getContext('2d');

  ctx.translate(size / 2, size / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0, 0, size, size,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.92)
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
export default function CropAvatarModal({ imageSrc, onCancel, onCropped }) {
  const [crop,           setCrop]           = useState({ x: 0, y: 0 });
  const [zoom,           setZoom]           = useState(1);
  const [rotation,       setRotation]       = useState(0);
  const [croppedArea,    setCroppedArea]    = useState(null);
  const [processing,     setProcessing]     = useState(false);

  const onCropComplete = useCallback((_, pixels) => setCroppedArea(pixels), []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedArea, rotation);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      onCropped(file);
    } catch {
      setProcessing(false);
    }
  };

  const SLIDER = {
    width: '100%',
    accentColor: '#4ade80',
    cursor: 'pointer',
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-2xl overflow-hidden border"
        style={{
          background: 'rgba(3,18,9,0.92)',
          border: '1px solid rgba(74,222,128,0.25)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(74,222,128,0.12)' }}
        >
          <h2 className="font-bold text-base" style={{ color: '#bbf7d0' }}>Crop Profile Picture</h2>
          <button
            className="btn btn-ghost btn-xs btn-circle cursor-pointer"
            style={{ color: 'rgba(134,239,172,0.6)' }}
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative" style={{ height: '340px', background: '#010806' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#010806' },
              cropAreaStyle: {
                border: '2px solid rgba(74,222,128,0.8)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(74,222,128,0.10)' }}>

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut size={14} style={{ color: 'rgba(134,239,172,0.5)', shrink: 0 }} />
            <input
              type="range"
              min={1} max={3} step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={SLIDER}
            />
            <ZoomIn size={14} style={{ color: 'rgba(134,239,172,0.5)' }} />
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCw size={14} style={{ color: 'rgba(134,239,172,0.5)' }} />
            <input
              type="range"
              min={-180} max={180} step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={SLIDER}
            />
            <span className="text-xs w-10 text-right shrink-0" style={{ color: 'rgba(134,239,172,0.45)' }}>
              {rotation}°
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              className="btn btn-sm flex-1 cursor-pointer"
              style={{
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                color: 'rgba(187,247,208,0.7)',
              }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm flex-1 gap-2 cursor-pointer"
              style={{
                background: processing ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.25)',
                border: '1px solid rgba(74,222,128,0.5)',
                color: '#bbf7d0',
              }}
              disabled={processing}
              onClick={handleConfirm}
            >
              {processing
                ? <span className="loading loading-spinner loading-xs" />
                : <Check size={14} />}
              {processing ? 'Processing…' : 'Crop & Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
