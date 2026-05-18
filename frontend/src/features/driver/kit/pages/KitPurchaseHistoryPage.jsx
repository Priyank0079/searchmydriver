import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Redirects legacy kit history URL to unified payment history */
const KitPurchaseHistoryPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/driver/payments', { replace: true });
  }, [navigate]);
  return null;
};

export default KitPurchaseHistoryPage;
