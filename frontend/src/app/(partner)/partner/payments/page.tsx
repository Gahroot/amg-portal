import { PaymentHistory } from "@/components/partner/payment-history";

export const metadata = {
  title: "Payment History | AMG Partner Portal",
  description: "View all past payments, filter by date and method, and export to CSV.",
};

export default function PaymentsPage() {
  return <PaymentHistory />;
}
