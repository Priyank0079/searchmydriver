import Button from '../../../../components/Button';
import { useKitOrderPayment } from '../../../../hooks/useKitOrderPayment';

const PayNowButton = ({ orderId, fullWidth = true, className = '', onPaid, label = 'Pay now' }) => {
  const { payExistingOrder, paying } = useKitOrderPayment();

  const handlePay = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    const result = await payExistingOrder(orderId);
    if (result?.success) onPaid?.();
  };

  return (
    <Button
      variant="driver"
      size="md"
      fullWidth={fullWidth}
      loading={paying}
      onClick={handlePay}
      className={`rounded-full ${className}`}
    >
      {label}
    </Button>
  );
};

export default PayNowButton;
