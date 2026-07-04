// Prayer time calculation using simplified algorithms
// Based on standard Islamic prayer time formulas

export interface PrayerTime {
  name: string;
  label: string;
  time: Date;
  timeString: string;
  attended: boolean;
}

export interface DailyPrayerTimes {
  fajr: PrayerTime;
  sunrise: PrayerTime;
  dhuhr: PrayerTime;
  asr: PrayerTime;
  maghrib: PrayerTime;
  isha: PrayerTime;
  date: string;
  day: string;
  hijriDate: string;
}

export const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
  sunrise: 'Sunrise',
};

// Convert degrees to radians
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Convert radians to degrees
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Keep astronomical angles in 0–360° range
function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Calculate Julian date
function getJulianDate(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

// Calculate sun declination
function getDeclination(julianDate: number): number {
  const n = julianDate - 2451545.0;
  const L = normalizeAngle(280.46 + 0.9856474 * n);
  const g = normalizeAngle(357.528 + 0.9856003 * n);
  const lambda = normalizeAngle(L + 1.915 * Math.sin(toRad(g)) + 0.02 * Math.sin(toRad(2 * g)));
  return 23.44 * Math.sin(toRad(lambda));
}

// Calculate equation of time
function getEquationOfTime(julianDate: number): number {
  const n = julianDate - 2451545.0;
  const L = normalizeAngle(280.46 + 0.9856474 * n);
  const g = normalizeAngle(357.528 + 0.9856003 * n);
  const lambda = normalizeAngle(L + 1.915 * Math.sin(toRad(g)) + 0.02 * Math.sin(toRad(2 * g)));
  const epsilon = 23.439 - 0.0000004 * n;
  const alpha = normalizeAngle(
    toDeg(Math.atan2(Math.cos(toRad(epsilon)) * Math.sin(toRad(lambda)), Math.cos(toRad(lambda))))
  );
  let delta = L - alpha;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return 4 * delta;
}

// Calculate prayer times
function calculatePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  method: string = 'Karachi',
  timezone: number = 5
): { fajr: Date; sunrise: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date } {
  const julianDate = getJulianDate(date);
  const declination = getDeclination(julianDate);
  const equationOfTime = getEquationOfTime(julianDate);

  // Dhuhr (midday) calculation
  const dhuhrTime = 12 + timezone - longitude / 15 - equationOfTime / 60;

  // Sunrise/sunset calculations
  const latRad = toRad(latitude);
  const decRad = toRad(declination);
  const sunriseAngle = toRad(-0.833);
  const sunriseHourAngle = toDeg(Math.acos((Math.sin(sunriseAngle) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad))));
  const sunriseTime = dhuhrTime - sunriseHourAngle / 15;
  const sunsetTime = dhuhrTime + sunriseHourAngle / 15;

  // Fajr angle based on method
  let fajrAngle = -18;
  let ishaAngle = -18;
  let maghribAngle = -0.833;

  switch (method.toLowerCase()) {
    case 'karachi':
      fajrAngle = -18;
      ishaAngle = -18;
      break;
    case 'muslimworldleague':
      fajrAngle = -18;
      ishaAngle = -17;
      break;
    case 'isna':
      fajrAngle = -15;
      ishaAngle = -15;
      break;
    case 'makkah':
      fajrAngle = -18.5;
      ishaAngle = -90; // 90 min after maghrib
      break;
    case 'dubai':
      fajrAngle = -18.2;
      ishaAngle = -18.2;
      break;
    case 'qatar':
      fajrAngle = -18;
      ishaAngle = -90;
      break;
    case 'kuwait':
      fajrAngle = -18;
      ishaAngle = -18;
      break;
    case 'singapore':
      fajrAngle = -20;
      ishaAngle = -18;
      break;
    case 'tehran':
      fajrAngle = -17.5;
      ishaAngle = -14;
      break;
    case 'turkey':
      fajrAngle = -18;
      ishaAngle = -17;
      break;
    case 'moonsighting':
      fajrAngle = -18;
      ishaAngle = -18;
      break;
    case 'egypt':
      fajrAngle = -19.5;
      ishaAngle = -17.5;
      break;
    default:
      fajrAngle = -18;
      ishaAngle = -18;
  }

  // Fajr
  const fajrRad = toRad(fajrAngle);
  const fajrHourAngle = toDeg(Math.acos((Math.sin(fajrRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad))));
  const fajrTime = dhuhrTime - fajrHourAngle / 15;

  // Asr
  const asrShadow = 1; // Shafi method (1 shadow length)
  const asrAngle = toDeg(Math.atan(1 / (asrShadow + Math.tan(Math.abs(latRad - decRad)))));
  const asrHourAngle = toDeg(Math.acos((Math.sin(toRad(asrAngle)) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad))));
  const asrTime = dhuhrTime + asrHourAngle / 15;

  // Maghrib
  const maghribTime = sunsetTime;

  // Isha
  let ishaTime: number;
  if (method.toLowerCase() === 'makkah' || method.toLowerCase() === 'qatar') {
    ishaTime = maghribTime + 1.5; // 90 minutes after maghrib
  } else {
    const ishaRad = toRad(ishaAngle);
    const ishaHourAngle = toDeg(Math.acos((Math.sin(ishaRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad))));
    ishaTime = dhuhrTime + ishaHourAngle / 15;
  }

  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  const toDate = (decimalTime: number): Date => {
    const normalized = ((decimalTime % 24) + 24) % 24;
    const hours = Math.floor(normalized);
    const minutes = Math.floor((normalized - hours) * 60);
    const seconds = Math.round(((normalized - hours) * 60 - minutes) * 60);
    const result = new Date(baseDate);
    result.setHours(hours, minutes, seconds);
    return result;
  };

  return {
    fajr: toDate(fajrTime),
    sunrise: toDate(sunriseTime),
    dhuhr: toDate(dhuhrTime),
    asr: toDate(asrTime),
    maghrib: toDate(maghribTime),
    isha: toDate(ishaTime),
  };
}

export function getCalculationMethod(method: string) {
  return method;
}

export function getPrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  method: string = 'Karachi',
  timezoneOffsetHours?: number
): DailyPrayerTimes {
  const tz = timezoneOffsetHours ?? -new Date().getTimezoneOffset() / 60;
  const times = calculatePrayerTimes(date, latitude, longitude, method, tz);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

  return {
    fajr: {
      name: 'fajr',
      label: 'Fajr',
      time: times.fajr,
      timeString: formatTime(times.fajr),
      attended: false,
    },
    sunrise: {
      name: 'sunrise',
      label: 'Sunrise',
      time: times.sunrise,
      timeString: formatTime(times.sunrise),
      attended: false,
    },
    dhuhr: {
      name: 'dhuhr',
      label: isFriday(date) ? 'Jummah' : 'Dhuhr',
      time: times.dhuhr,
      timeString: formatTime(times.dhuhr),
      attended: false,
    },
    asr: {
      name: 'asr',
      label: 'Asr',
      time: times.asr,
      timeString: formatTime(times.asr),
      attended: false,
    },
    maghrib: {
      name: 'maghrib',
      label: 'Maghrib',
      time: times.maghrib,
      timeString: formatTime(times.maghrib),
      attended: false,
    },
    isha: {
      name: 'isha',
      label: 'Isha',
      time: times.isha,
      timeString: formatTime(times.isha),
      attended: false,
    },
    date: dateStr,
    day: dayName,
    hijriDate: getHijriDate(date),
  };
}

export function getHijriDate(date: Date = new Date()): string {
  try {
    const d = new Date(date);
    const hijriDate = d.toLocaleDateString('en-US-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return hijriDate;
  } catch {
    return '';
  }
}

export function isFriday(date: Date = new Date()): boolean {
  return date.getDay() === 5;
}

export function getPrayerDisplayLabel(name: string, date: Date = new Date()): string {
  if (name === 'dhuhr' && isFriday(date)) return 'Jummah';
  return PRAYER_LABELS[name] || name;
}

/**
 * Returns the prayer whose time window is currently active.
 * No prayer is active between sunrise–dhuhr, or after midnight until fajr.
 */
function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function getActivePrayer(times: DailyPrayerTimes, now: Date = new Date()): PrayerTime | null {
  const nowM = minutesSinceMidnight(now);
  const fajrM = minutesSinceMidnight(times.fajr.time);
  const sunriseM = minutesSinceMidnight(times.sunrise.time);
  const dhuhrM = minutesSinceMidnight(times.dhuhr.time);
  const asrM = minutesSinceMidnight(times.asr.time);
  const maghribM = minutesSinceMidnight(times.maghrib.time);
  const ishaM = minutesSinceMidnight(times.isha.time);

  if (nowM >= fajrM && nowM < sunriseM) return times.fajr;
  if (nowM >= dhuhrM && nowM < asrM) return times.dhuhr;
  if (nowM >= asrM && nowM < maghribM) return times.asr;
  if (nowM >= maghribM && nowM < ishaM) return times.maghrib;
  if (nowM >= ishaM) return times.isha;

  return null;
}

export function getNextPrayer(times: DailyPrayerTimes): PrayerTime | null {
  const now = new Date();
  const prayers = [times.fajr, times.dhuhr, times.asr, times.maghrib, times.isha];

  for (const prayer of prayers) {
    if (prayer.time > now) {
      return prayer;
    }
  }

  return null;
}

export function getCurrentPrayer(times: DailyPrayerTimes): PrayerTime | null {
  const now = new Date();
  const prayers = [times.fajr, times.dhuhr, times.asr, times.maghrib, times.isha];

  let current: PrayerTime | null = null;
  for (const prayer of prayers) {
    if (prayer.time <= now) {
      current = prayer;
    }
  }

  return current;
}

export function getTimeUntilPrayer(prayerTime: Date): string {
  const now = new Date();
  const diff = prayerTime.getTime() - now.getTime();

  if (diff <= 0) return 'Now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getMonthPrayerTimes(
  year: number,
  month: number,
  latitude: number,
  longitude: number,
  method: string = 'Karachi',
  timezoneOffsetHours?: number
): DailyPrayerTimes[] {
  const days: DailyPrayerTimes[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push(getPrayerTimes(date, latitude, longitude, method, timezoneOffsetHours));
  }

  return days;
}

export const CALCULATION_METHODS = [
  { value: 'Karachi', label: 'Karachi (Pakistan)' },
  { value: 'MuslimWorldLeague', label: 'Muslim World League' },
  { value: 'ISNA', label: 'ISNA (North America)' },
  { value: 'Makkah', label: 'Umm al-Qura (Makkah)' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Turkey', label: 'Turkey (Diyanet)' },
  { value: 'Egypt', label: 'Egyptian (Authority)' },
  { value: 'Moonsighting', label: 'Moonsighting Committee' },
  { value: 'Tehran', label: 'Tehran (Institute)' },
];
