const TZ = 'Asia/Ho_Chi_Minh';

/** "07/01/2027" theo giờ Việt Nam; `withYear: false` → "07/01". Tự ghép vì `vi-VN` không năm cho ra "07-01". */
export function vnDate(iso: string, withYear = true): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return withYear ? `${get('day')}/${get('month')}/${get('year')}` : `${get('day')}/${get('month')}`;
}

/** Ngày cuối còn chạy: mốc kết thúc là 0h ngày hôm sau → lùi 1 ms ("31/12"). */
export const vnLastDay = (endIso: string): string => vnDate(new Date(Date.parse(endIso) - 1).toISOString(), false);
