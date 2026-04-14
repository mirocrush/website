import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPortfolioBySlug } from '../api/portfolioApi';
import ThemeRenderer from '../themes/ThemeRenderer';

export default function PortfolioView() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [notFound,  setNotFound]  = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getPortfolioBySlug(slug)
      .then((res) => setPortfolio(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (notFound || !portfolio) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-2">
        <h2 className="text-xl font-bold text-base-content/60">Portfolio not found</h2>
        <p className="text-sm text-base-content/40">
          The link may be incorrect or this portfolio has been removed.
        </p>
      </div>
    );
  }

  return <ThemeRenderer portfolio={portfolio} />;
}
