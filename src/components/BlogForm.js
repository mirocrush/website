import { useState } from 'react';
import { Plus, X, Paperclip } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import FileUpload from './FileUpload';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block', 'link',
];

export default function BlogForm({ initialValues = {}, onSubmit, loading, isEditing }) {
  const [title,    setTitle]    = useState(initialValues.title   || '');
  const [content,  setContent]  = useState(initialValues.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState(initialValues.tags    || []);
  const [images,   setImages]   = useState(initialValues.images  || []);
  const [errors,   setErrors]   = useState({});

  const isEmpty = (html) => !html || html.replace(/<[^>]*>/g, '').trim() === '';

  const validate = () => {
    const e = {};
    if (!title.trim())   e.title   = 'Title is required';
    if (isEmpty(content)) e.content = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
    if (e.key === ',' || e.key === ' ') { e.preventDefault(); handleAddTag(); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ title: title.trim(), content, tags, images });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

      {/* Title */}
      <div className="form-control gap-1.5">
        <label className="label pb-0">
          <span className="label-text font-semibold">
            Issue Title <span className="text-error">*</span>
          </span>
        </label>
        <input
          className={`input input-bordered w-full${errors.title ? ' input-error' : ''}`}
          type="text"
          placeholder="Short, descriptive summary of the problem"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: '' })); }}
          autoFocus
        />
        {errors.title && (
          <p className="text-error text-xs mt-0.5">{errors.title}</p>
        )}
      </div>

      {/* Rich text editor */}
      <div className="form-control gap-1.5">
        <label className="label pb-0">
          <span className={`label-text font-semibold${errors.content ? ' text-error' : ''}`}>
            Description <span className="text-error">*</span>
          </span>
        </label>
        <div className={`rounded-xl overflow-hidden border${errors.content ? ' border-error' : ' border-base-300'}`}>
          <ReactQuill
            theme="snow"
            value={content}
            onChange={(v) => { setContent(v); if (errors.content) setErrors((p) => ({ ...p, content: '' })); }}
            modules={QUILL_MODULES}
            formats={QUILL_FORMATS}
            placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior, environment info…"
            style={{ minHeight: 220 }}
          />
        </div>
        {errors.content && (
          <p className="text-error text-xs mt-0.5">{errors.content}</p>
        )}
      </div>

      {/* Labels / Tags */}
      <div className="form-control gap-1.5">
        <label className="label pb-0">
          <span className="label-text font-semibold">Labels</span>
          <span className="label-text-alt text-base-content/40">optional · press Enter to add</span>
        </label>
        <div className="flex gap-2">
          <input
            className="input input-bordered input-sm flex-1"
            placeholder="bug, enhancement, question…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tags.map((tag) => (
              <span key={tag} className="badge badge-primary badge-outline gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  className="hover:text-error transition-colors"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="border-t border-base-200 pt-5">
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-3">
          <Paperclip size={15} className="text-base-content/50" />
          Attachments
          <span className="text-xs font-normal text-base-content/40">(optional)</span>
        </p>
        <FileUpload type="images" value={images} onChange={setImages} />
      </div>

      {/* Submit */}
      <div className="border-t border-base-200 pt-4 flex justify-end">
        <button
          type="submit"
          className="btn btn-primary px-8"
          disabled={loading}
        >
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Issue'}
        </button>
      </div>
    </form>
  );
}
