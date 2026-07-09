import { supabase } from '@/lib/supabase';
import { formatHijriDate } from '@/lib/hijri';
import { PRAYER_NAMES, type DailyPrayerTimes } from '@/lib/prayerTimes';

export { formatHijriDate } from '@/lib/hijri';

export type AttendanceRow = {
  prayer_name: string;
  attended: boolean;
  prayer_date: string;
};

type PrayerTimesForDay = DailyPrayerTimes;

type AttendanceListener = () => void;
const attendanceListeners = new Set<AttendanceListener>();

export function onAttendanceUpdated(listener: AttendanceListener) {
  attendanceListeners.add(listener);
  return () => {
    attendanceListeners.delete(listener);
  };
}

function emitAttendanceUpdated() {
  attendanceListeners.forEach((listener) => listener());
}

export async function togglePrayerAttendance(
  userId: string,
  prayerName: string,
  prayerDate: string,
  attended: boolean
) {
  const { data: existing, error: fetchError } = await supabase
    .from('prayer_attendance')
    .select('id')
    .eq('user_id', userId)
    .eq('prayer_name', prayerName)
    .eq('prayer_date', prayerDate)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    const { error } = await supabase
      .from('prayer_attendance')
      .update({ attended })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('prayer_attendance').insert({
      prayer_name: prayerName,
      attended,
      prayer_date: prayerDate,
      user_id: userId,
    });
    if (error) throw error;
  }

  emitAttendanceUpdated();
}

export function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateString(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}


export function isToday(dateStr: string) {
  return dateStr === toDateString(new Date());
}

/** True once prayer time has started (past days always allowed). */
export function canMarkPrayerAttendance(
  prayerTime: Date,
  prayerDate: string,
  now: Date = new Date()
): boolean {
  const todayStr = toDateString(now);
  if (prayerDate > todayStr) return false;
  if (prayerDate < todayStr) return true;
  return prayerTime <= now;
}

/** Count attended vs eligible prayers (time started only; missing record = missed). */
export function getAttendanceStatsForRange(
  attendance: AttendanceRow[],
  getTimesForDate: (date: Date) => PrayerTimesForDay,
  days: number,
  now: Date = new Date()
): { attended: number; eligible: number; rate: number } {
  let attended = 0;
  let eligible = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    const times = getTimesForDate(d);

    for (const name of PRAYER_NAMES) {
      const prayerTime = times[name].time;
      if (!prayerTime || !canMarkPrayerAttendance(prayerTime, dateStr, now)) continue;

      eligible++;
      const record = attendance.find((a) => a.prayer_date === dateStr && a.prayer_name === name);
      if (record?.attended) attended++;
    }
  }

  return {
    attended,
    eligible,
    rate: eligible === 0 ? 0 : Math.round((attended / eligible) * 100),
  };
}

/** Per-prayer attended vs eligible over a date range. */
export function getPerPrayerStatsForRange(
  attendance: AttendanceRow[],
  getTimesForDate: (date: Date) => PrayerTimesForDay,
  days: number,
  now: Date = new Date()
): Record<string, { attended: number; eligible: number; rate: number }> {
  const stats: Record<string, { attended: number; eligible: number; rate: number }> = {};

  for (const name of PRAYER_NAMES) {
    stats[name] = { attended: 0, eligible: 0, rate: 0 };
  }

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    const times = getTimesForDate(d);

    for (const name of PRAYER_NAMES) {
      const prayerTime = times[name].time;
      if (!prayerTime || !canMarkPrayerAttendance(prayerTime, dateStr, now)) continue;

      stats[name].eligible++;
      const record = attendance.find((a) => a.prayer_date === dateStr && a.prayer_name === name);
      if (record?.attended) stats[name].attended++;
    }
  }

  for (const name of PRAYER_NAMES) {
    const { attended, eligible } = stats[name];
    stats[name].rate = eligible === 0 ? 0 : Math.round((attended / eligible) * 100);
  }

  return stats;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Per-prayer stats for a calendar month (28–31 days; skips future days in current month). */
export function getPerPrayerStatsForMonth(
  attendance: AttendanceRow[],
  getTimesForDate: (date: Date) => PrayerTimesForDay,
  year: number,
  month: number,
  now: Date = new Date()
): Record<string, { attended: number; eligible: number; rate: number }> {
  const stats: Record<string, { attended: number; eligible: number; rate: number }> = {};

  for (const name of PRAYER_NAMES) {
    stats[name] = { attended: 0, eligible: 0, rate: 0 };
  }

  const daysInMonth = getDaysInMonth(year, month);
  const todayStr = toDateString(now);

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = toDateString(d);
    if (dateStr > todayStr) continue;

    const times = getTimesForDate(d);
    for (const name of PRAYER_NAMES) {
      const prayerTime = times[name].time;
      if (!canMarkPrayerAttendance(prayerTime, dateStr, now)) continue;

      stats[name].eligible++;
      const record = attendance.find((a) => a.prayer_date === dateStr && a.prayer_name === name);
      if (record?.attended) stats[name].attended++;
    }
  }

  for (const name of PRAYER_NAMES) {
    const { attended, eligible } = stats[name];
    stats[name].rate = eligible === 0 ? 0 : Math.round((attended / eligible) * 100);
  }

  return stats;
}

export function getMonthPerformanceLabel(year: number, month: number, now: Date = new Date()): string {
  const totalDays = getDaysInMonth(year, month);
  const label = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  if (isCurrentMonth) {
    return `${label} · day 1–${now.getDate()} of ${totalDays}`;
  }
  return `${label} · ${totalDays} days`;
}

/** Day stats for one date — only prayers whose time has started count. */
export function getDayAttendanceStats(
  attendance: AttendanceRow[],
  getTimesForDate: (date: Date) => PrayerTimesForDay,
  dateStr: string,
  now: Date = new Date()
): { attended: number; eligible: number; rate: number } {
  const d = parseDateString(dateStr);
  const times = getTimesForDate(d);
  let attended = 0;
  let eligible = 0;

  for (const name of PRAYER_NAMES) {
    const prayerTime = times[name].time;
    if (!prayerTime || !canMarkPrayerAttendance(prayerTime, dateStr, now)) continue;

    eligible++;
    const record = attendance.find((a) => a.prayer_date === dateStr && a.prayer_name === name);
    if (record?.attended) attended++;
  }

  return {
    attended,
    eligible,
    rate: eligible === 0 ? 0 : Math.round((attended / eligible) * 100),
  };
}
