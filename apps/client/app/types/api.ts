import type { Order, Esim } from './order';
// 상대경로 — mobile 이 이 파일을 직접 import 한다(#shared 별칭 없음)
import type { IssueConsent } from '../../shared/consent/issue-consent';

// Verify Order
export interface VerifyOrderRequest {
  fullName: string;
  phoneNumber: string;
  orderId: number;
  productOrderId?: number;
}

export interface VerifyOrderResponse {
  verified: boolean;
  cancelled?: boolean;
  details: Order[];
}

// Activate Order
export interface ActivateOrderRequest {
  receiverName: string;
  receiverPhoneNumber: string;
  optionManageCode: string;
  orderId: number;
  placeOrderDate: Date;
  planCountriesKr: string[];
  planDataDuration: number;
  planDataTypeKr: string;
  planNameKr: string;
  planTypeId: string;
  productName: string;
  productOrderId: number;
  quantity: number;
  startCountry: string;
  startDate: string;
  startTime: number;
  endDate: string;
  startTimeZone: string;
  totalPaymentAmount: number;
  // 발급 필수 동의 판 · 해시(client-consent-log spec F-3) — 서버가 상수와 대조한다
  consent: IssueConsent;
}

export type ActivateOrderResponse = VerifyOrderResponse;

// Withdraw Cancel (취소철회) — CANCEL_REQUEST 대기 건만 가능
export interface WithdrawCancelRequest {
  fullName: string;
  phoneNumber: string;
  orderId: number;
  productOrderId: number;
}

export interface WithdrawCancelResponse {
  withdrawn: boolean;
}

// Re-export for convenience
export type { Order, Esim };
