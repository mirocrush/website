import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { uploadFile, deleteFile } from '../api/blogApi';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// type: 'images' | 'pdfs'
// value: array of { bucket, path, url, mimeType, size }
// onChange: (updatedArray) => void
export default function FileUpload({ type, value = [], onChange }) {
  const inputRef = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [removing,   setRemoving]   = useState({}); // { [index]: true } while deleting
  const [uploadErr,  setUploadErr]  = useState('');
  const [removeErr,  setRemoveErr]  = useState('');

  const isImages = type === 'images';
  const accept   = isImages ? 'image/jpeg,image/png,image/gif,image/webp' : 'application/pdf';
  const label    = isImages ? 'Images' : 'PDFs';

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErr('');

    const results = [];
    for (const file of Array.from(files)) {
      try {
        const res = await uploadFile(file);
        if (res.success) results.push(res.data);
        else setUploadErr(`Failed to upload "${file.name}": ${res.message}`);
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        setUploadErr(`Failed to upload "${file.name}": ${msg}`);
      }
    }

    if (results.length > 0) onChange([...value, ...results]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // ── Remove (delete from Supabase, then remove from state) ──────────────────

  const handleRemove = async (index) => {
    const file = value[index];
    setRemoving((prev) => ({ ...prev, [index]: true }));
    setRemoveErr('');

    try {
      await deleteFile({ bucket: file.bucket, path: file.path });
      onChange(value.filter((_, i) => i !== index));
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setRemoveErr(`Failed to remove file: ${msg}`);
    } finally {
      setRemoving((prev) => ({ ...prev, [index]: false }));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <p className="text-sm font-semibold mb-1">{label}</p>

      {/* Drop zone */}
      <label
        className={[
          'flex flex-col items-center justify-center border-2 border-dashed border-base-300',
          'rounded-xl p-8 transition-colors',
          uploading ? 'cursor-default bg-base-200' : 'cursor-pointer hover:bg-base-200',
        ].join(' ')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={(e) => {
          if (uploading) { e.preventDefault(); return; }
          inputRef.current?.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-xs text-base-content/50">Uploading…</span>
          </div>
        ) : (
          <>
            <Upload size={36} className="text-primary mb-2" />
            <p className="text-sm text-base-content/60 text-center">
              Drag &amp; drop or <strong>click to select</strong> {label.toLowerCase()}
            </p>
            <p className="text-xs text-base-content/40 mt-0.5">
              {isImages ? 'JPG, PNG, GIF, WEBP' : 'PDF'} · max 10 MB each
            </p>
          </>
        )}
      </label>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploadErr && (
        <div role="alert" className="alert alert-error text-sm mt-2">
          <AlertCircle size={16} />
          <span>{uploadErr}</span>
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setUploadErr('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {removeErr && (
        <div role="alert" className="alert alert-error text-sm mt-2">
          <AlertCircle size={16} />
          <span>{removeErr}</span>
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setRemoveErr('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* File list */}
      {value.length > 0 && (
        <div className="mt-3">
          {isImages ? (
            // ── Image grid with size tooltip ──
            <div className="flex flex-wrap gap-2">
              {value.map((file, i) => (
                <div
                  key={file.path}
                  className="relative w-24 h-24"
                  title={`${file.path.split('/').pop()} · ${formatBytes(file.size)}`}
                >
                  <img
                    src={file.url}
                    alt={`upload-${i}`}
                    className={[
                      'w-full h-full object-cover rounded-lg border border-base-300',
                      'transition-opacity duration-200',
                      removing[i] ? 'opacity-40' : 'opacity-100',
                    ].join(' ')}
                  />
                  {/* Size badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-px rounded-b-lg">
                    {formatBytes(file.size)}
                  </div>
                  {/* Remove button */}
                  <button
                    className="absolute top-1 right-1 bg-black/55 hover:bg-error text-white rounded-full p-0.5 transition-colors disabled:bg-black/30"
                    disabled={removing[i]}
                    onClick={() => handleRemove(i)}
                  >
                    {removing[i]
                      ? <span className="loading loading-spinner loading-xs" style={{ width: 12, height: 12 }} />
                      : <X size={12} />
                    }
                  </button>
                </div>
              ))}
            </div>
          ) : (
            // ── PDF list with size ──
            <div className="flex flex-col gap-1">
              {value.map((file, i) => (
                <div
                  key={file.path}
                  className={[
                    'flex items-center gap-2 p-2 border border-base-300 rounded-lg bg-base-100',
                    'transition-opacity duration-200',
                    removing[i] ? 'opacity-50' : 'opacity-100',
                  ].join(' ')}
                >
                  <FileText size={20} className="text-error shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-all">{file.path.split('/').pop()}</p>
                    <p className="text-xs text-base-content/50">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm text-error disabled:opacity-50"
                    disabled={removing[i]}
                    onClick={() => handleRemove(i)}
                    title={removing[i] ? 'Removing…' : 'Remove & delete from storage'}
                  >
                    {removing[i]
                      ? <span className="loading loading-spinner loading-xs text-error" />
                      : <X size={16} />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
