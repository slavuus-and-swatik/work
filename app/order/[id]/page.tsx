import OrderStatus from './order-status';

export default async function OrderStatusPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <OrderStatus orderId={id} token={query.token || ''} />;
}
