import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import BlogForm from '../components/BlogForm';
import { getBlog, createBlog, updateBlog } from '../api/blogApi';
import { useAuth } from '../context/AuthContext';

export default function CreateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [initialValues, setInitialValues] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(isEditing);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    const fetchBlog = async () => {
      setFetching(true);
      try {
        const res = await getBlog(id);
        setInitialValues(res.data.data);
      } catch {
        setError('Failed to load issue for editing.');
      } finally {
        setFetching(false);
      }
    };
    fetchBlog();
  }, [id, isEditing]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    try {
      if (isEditing) {
        await updateBlog({ id, ...values });
        setSuccessMsg('Issue updated successfully!');
        setTimeout(() => navigate(`/blogs/${id}`), 1200);
      } else {
        const res = await createBlog({
          ...values,
          author:   user?.displayName || user?.username || 'Anonymous',
          userId:   user?._id || user?.id || null,
          username: user?.username || null,
        });
        setSuccessMsg('Issue reported successfully!');
        setTimeout(() => navigate(`/blogs/${res.data.data.id}`), 1200);
      }
    } catch {
      setError('Failed to save the issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-screen-md px-4 py-8">

      <button
        className="btn btn-ghost btn-sm gap-1 mb-6"
        onClick={() => navigate('/blogs')}
      >
        <ArrowLeft size={16} /> Back to Issues
      </button>

      <div className="card bg-base-100 shadow-md border border-base-300">
        <div className="card-body p-6 md:p-10">
          <h1 className="text-xl font-bold mb-1">
            {isEditing ? 'Edit Issue' : 'Report an Issue'}
          </h1>
          <p className="text-sm text-base-content/60 mb-6">
            {isEditing
              ? 'Update the details below and save your changes.'
              : 'Describe the problem or suggestion in detail so it can be addressed.'}
          </p>

          {fetching && (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-lg" />
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error text-sm mb-4">
              <span>{error}</span>
            </div>
          )}

          {!fetching && (
            <BlogForm
              initialValues={isEditing ? (initialValues || {}) : {}}
              onSubmit={handleSubmit}
              loading={loading}
              isEditing={isEditing}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div role="alert" className="alert alert-success shadow-lg">
            <span className="text-sm">{successMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
