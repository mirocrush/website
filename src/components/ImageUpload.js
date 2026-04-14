import { useRef, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { uploadFile } from '../api/blogApi';

// Lightweight single-image upload widget.
// Props:
//   value    — current image URL string (or '')
//   onChange — called with the new URL string after upload, or '' on clear
//   label    — optional label text (default 'Image')
//   size     — thumbnail size in px (default 96)
export default function ImageUpload({ value, onChange, label = 'Image', size = 96 }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await uploadFile(file);
      if (res.success) {
        onChange(res.data.url);
      } else {
        setError(res.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div>
      {label && (
        <p className="text-xs text-base-content/60 mb-1.5">{label}</p>
      )}

      <div className="flex items-center gap-4">
        {/* Thumbnail / drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
          style={{ width: size, height: size }}
          className={[
            'rounded-xl border-2 border-dashed shrink-0 overflow-hidden',
            'flex items-center justify-center transition-colors duration-150',
            value
              ? 'border-transparent'
              : 'border-base-300 bg-base-200 hover:bg-base-300',
            loading ? 'cursor-default' : 'cursor-pointer',
          ].join(' ')}
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm text-primary" />
          ) : value ? (
            <img
              src={value}
              alt="preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Upload size={28} className="text-base-content/30" />
          )}
        </div>

        {/* Actions */}
        <div>
          <div className="flex items-center gap-1">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {value ? 'Change' : 'Upload'}
            </button>
            {value && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onChange('')}
                title="Remove image"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-xs text-base-content/40 mt-1">
            JPG, PNG, GIF, WEBP · max 10 MB
          </p>
          {error && (
            <div role="alert" className="alert alert-error text-xs mt-1 py-1 px-2">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
