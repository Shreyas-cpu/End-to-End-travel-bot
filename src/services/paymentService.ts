import { bookingComPaymentProvider, PaymentSessionResponse, PaymentVerificationResult } from '../providers/payment/bookingComPaymentProvider';

export { PaymentSessionResponse, PaymentVerificationResult };

export interface PaymentSession extends PaymentSessionResponse {}

export class BookingComPaymentService {
  async createPaymentSession(booking: {
    bookingReference: string;
    totalAmount: number;
    currency?: string;
    description?: string;
    passengerEmail?: string;
    orderToken?: string;
  }): Promise<PaymentSession> {
    return bookingComPaymentProvider.createPaymentSession({
      bookingReference: booking.bookingReference,
      totalCost: booking.totalAmount,
      currency: booking.currency,
      passengerEmail: booking.passengerEmail,
      orderToken: booking.orderToken
    });
  }

  async capturePayment(sessionId: string, paymentMethod: string = 'credit_card'): Promise<{ success: boolean; transactionId: string; message: string }> {
    const res = await bookingComPaymentProvider.verifyPayment(sessionId, paymentMethod);
    return {
      success: res.success,
      transactionId: res.transactionId,
      message: res.message
    };
  }
}

export const bookingComPaymentService = new BookingComPaymentService();
