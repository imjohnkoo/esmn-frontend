import { format, addDays } from 'date-fns';

/**
 * Format date to Korean format (2024년 1월 15일) — 한국 시간(Asia/Seoul) 고정.
 * 실행 환경 시간대를 따르면 SSR(prod 컨테이너 = UTC)과 브라우저(KST)가 15:00~23:59 UTC 주문에서 다른 날짜를 그려
 * hydration mismatch 가 난다(4-step SSR 복원 도입 뒤 details 에서 드러남 — QA ⑥).
 */
const KST_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function formatDateString(date: Date | string): string {
  const value = new Date(date);
  // 해석할 수 없는 값이면 빈 글자 — formatToParts 가 RangeError 를 던져 SSR 페이지 전체가 500 이 되지 않게
  if (Number.isNaN(value.getTime())) return '';
  const parts = KST_DATE.formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}년 ${get('month')}월 ${get('day')}일`;
}

/**
 * Format date string to short Korean format (24년 01월 15일)
 */
export function formatDateStringToKorean(date: string): string {
  const dateObj = new Date(date);
  return format(dateObj, 'yy년 MM월 dd일');
}

/**
 * Format hour to Korean AM/PM format
 */
export function formatHourToKorean(hour: number): string {
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}시`;
}

/**
 * Calculate end date based on start date and duration
 */
export function calculateEndDate(startDate: string, durationDays: number): string {
  const start = new Date(startDate);
  const end = addDays(start, durationDays);
  return format(end, 'yyyy-MM-dd');
}

/**
 * Generate array of hours (0-23) for selection
 */
export function getHourOptions(): { value: number; label: string }[] {
  return Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: formatHourToKorean(i),
  }));
}
