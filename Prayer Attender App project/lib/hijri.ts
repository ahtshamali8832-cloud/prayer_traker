export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qidah',
  'Dhu al-Hijjah',
] as const;

/** Hijri calendar used per prayer calculation method / region */
const HIJRI_CALENDAR_BY_METHOD: Record<string, string> = {
  Karachi: 'islamic-umalqura',
  Moonsighting: 'islamic',
  Makkah: 'islamic-umalqura',
  Dubai: 'islamic-umalqura',
  Qatar: 'islamic-umalqura',
  Kuwait: 'islamic-umalqura',
  MuslimWorldLeague: 'islamic',
  ISNA: 'islamic',
  Singapore: 'islamic',
  Turkey: 'islamic-civil',
  Egypt: 'islamic-civil',
  Tehran: 'islamic-tbla',
};

/**
 * Pakistan (Karachi) and global moon-sighting communities often start the Hijri
 * month one day after Saudi Umm al-Qura when the hilal is not seen locally.
 */
const HIJRI_GREGORIAN_OFFSET_BY_METHOD: Record<string, number> = {
  Karachi: -1,
  Moonsighting: -1,
};

export interface HijriDateOptions {
  calculationMethod?: string;
  now?: Date;
  maghribTime?: Date;
}

export function getHijriCalendarForMethod(method?: string): string {
  if (!method) return 'islamic-umalqura';
  return HIJRI_CALENDAR_BY_METHOD[method] ?? 'islamic-umalqura';
}

export function isSameGregorianDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hijriFormatter(calendar: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(`en-u-ca-${calendar}`, options);
}

function normalizeHijriMonthKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`ʻʼ]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveHijriMonthIndex(monthPart: string): number {
  const key = normalizeHijriMonthKey(monthPart);

  const aliases: Record<string, number> = {
    muharram: 0,
    safar: 1,
    'rabi al awwal': 2,
    'rabi i': 2,
    'rabi 1': 2,
    'rabi al thani': 3,
    'rabi ii': 3,
    'rabi 2': 3,
    'jumada al awwal': 4,
    'jumada i': 4,
    'jumada 1': 4,
    'jumada al thani': 5,
    'jumada ii': 5,
    'jumada 2': 5,
    rajab: 6,
    shaban: 7,
    ramadan: 8,
    shawwal: 9,
    'dhu al qidah': 10,
    'dhul qidah': 10,
    'dhu al qi dah': 10,
    'dhu al hijjah': 11,
    'dhul hijjah': 11,
  };

  if (key in aliases) {
    return aliases[key];
  }

  const exactIndex = HIJRI_MONTHS.findIndex(
    (month) => normalizeHijriMonthKey(month) === key
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  if (key.includes('hijjah')) return 11;
  if (key.includes('qidah') || key.includes('qadah')) return 10;
  if (key.includes('shawwal')) return 9;
  if (key.includes('ramadan')) return 8;
  if (key.includes('shaban')) return 7;
  if (key.includes('rajab')) return 6;
  if (key.includes('jumada') && (key.includes('ii') || key.includes('thani') || key.includes('2'))) {
    return 5;
  }
  if (key.includes('jumada')) return 4;
  if (key.includes('rabi') && (key.includes('ii') || key.includes('thani') || key.includes('2'))) {
    return 3;
  }
  if (key.includes('rabi')) return 2;
  if (key.includes('safar')) return 1;
  if (key.includes('muharram')) return 0;

  return 0;
}

/**
 * Islamic day changes at Maghrib. Before sunset, today's displayed Hijri date
 * follows the previous Gregorian day's mapping.
 */
export function getGregorianReferenceForHijri(date: Date, options: HijriDateOptions = {}): Date {
  const now = options.now ?? new Date();
  const maghribTime = options.maghribTime;

  let reference = date;

  if (maghribTime && isSameGregorianDay(date, now) && now.getTime() < maghribTime.getTime()) {
    reference = new Date(date);
    reference.setDate(reference.getDate() - 1);
  }

  const offset = options.calculationMethod
    ? (HIJRI_GREGORIAN_OFFSET_BY_METHOD[options.calculationMethod] ?? 0)
    : 0;

  if (offset !== 0) {
    reference = new Date(reference);
    reference.setDate(reference.getDate() + offset);
  }

  return reference;
}

export function getHijriReferenceDate(date: Date, options: HijriDateOptions = {}): Date {
  return getGregorianReferenceForHijri(date, options);
}

export function getHijriInfo(date: Date, options: HijriDateOptions = {}) {
  const calendar = getHijriCalendarForMethod(options.calculationMethod);
  const referenceDate = getHijriReferenceDate(date, options);

  try {
    const parts = hijriFormatter(calendar, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(referenceDate);
    const day = parseInt(parts.find((part) => part.type === 'day')?.value ?? '1', 10);
    const monthPart = parts.find((part) => part.type === 'month')?.value ?? 'Muharram';
    const yearPart = parts.find((part) => part.type === 'year')?.value ?? '';
    const monthIndex = resolveHijriMonthIndex(monthPart);

    return {
      day: Number.isNaN(day) ? 1 : day,
      month: HIJRI_MONTHS[monthIndex],
      monthIndex,
      year: yearPart,
    };
  } catch {
    return { day: 1, month: HIJRI_MONTHS[0], monthIndex: 0, year: '' };
  }
}

export function getHijriDate(date: Date = new Date(), options: HijriDateOptions = {}): string {
  const calendar = getHijriCalendarForMethod(options.calculationMethod);
  const referenceDate = getHijriReferenceDate(date, options);

  try {
    return hijriFormatter(calendar, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(referenceDate);
  } catch {
    return '';
  }
}

export function formatHijriDate(date: Date, options: HijriDateOptions = {}): string {
  const calendar = getHijriCalendarForMethod(options.calculationMethod);
  const referenceDate = getHijriReferenceDate(date, options);

  try {
    return hijriFormatter(calendar, {
      day: 'numeric',
      month: 'short',
    }).format(referenceDate);
  } catch {
    return '';
  }
}
