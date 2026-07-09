import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { getPrayerTimes, PRAYER_NAMES, getPrayerDisplayLabel } from '@/lib/prayerTimes';
import { togglePrayerAttendance, toDateString, parseDateString, canMarkPrayerAttendance, onAttendanceUpdated } from '@/lib/attendance';
import { getPrayerCalcFromSettings } from '@/lib/location';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Flame,
  TrendingUp,
  Calendar,
  Award,
} from 'lucide-react-native';

interface AttendanceRecord {
  id: string;
  prayer_name: string;
  attended: boolean;
  prayer_date: string;
  created_at: string;
}

interface PrayerSettings {
  latitude: number;
  longitude: number;
  calculation_method: string;
}

export default function AttendanceScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));

  const loadData = useCallback(async (showLoader = false) => {
    if (!user) return;
    try {
      if (showLoader) setLoading(true);
      const { data: settingsData } = await supabase
        .from('prayer_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
      }

      const { data } = await supabase
        .from('prayer_attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('prayer_date', { ascending: false });

      setAttendance(data || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData(true);
  }, [selectedDate, user, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData(false);
    }, [user, loadData])
  );

  useEffect(() => {
    const unsubscribe = onAttendanceUpdated(() => {
      if (user) loadData(false);
    });
    return unsubscribe;
  }, [user, loadData]);

  const getPrayerTimesForDate = (dateStr: string) => {
    const calc = getPrayerCalcFromSettings(settings);
    return getPrayerTimes(
      parseDateString(dateStr),
      calc.latitude,
      calc.longitude,
      calc.method,
      calc.timezoneOffsetHours
    );
  };

  const getAttendanceForDate = (dateStr: string) => {
    return attendance.filter((a) => a.prayer_date === dateStr);
  };

  const getStreak = () => {
    const sorted = [...attendance].sort((a, b) =>
      new Date(b.prayer_date).getTime() - new Date(a.prayer_date).getTime()
    );

    const dateMap = new Map<string, number>();
    sorted.forEach((record) => {
      if (record.attended) {
        const count = dateMap.get(record.prayer_date) || 0;
        dateMap.set(record.prayer_date, count + 1);
      }
    });

    let streak = 0;
    let checkDate = new Date();

    while (true) {
      const dateStr = toDateString(checkDate);
      const prayers = dateMap.get(dateStr) || 0;
      if (prayers >= 5) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const getOverallRate = () => {
    const total = attendance.length;
    if (total === 0) return 0;
    const attended = attendance.filter((a) => a.attended).length;
    return Math.round((attended / total) * 100);
  };

  const getTodayStats = () => {
    const today = toDateString(new Date());
    const todayRecords = attendance.filter((a) => a.prayer_date === today);
    const attended = todayRecords.filter((a) => a.attended).length;
    return { attended, total: 5 };
  };

  const getWeekDates = () => {
    const dates: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  };

  const handleTogglePrayer = async (prayerName: string) => {
    if (!user) return;
    const prayerTimes = getPrayerTimesForDate(selectedDate);
    const prayer = (prayerTimes as Record<string, { time: Date }>)[prayerName];
    if (!canMarkPrayerAttendance(prayer.time, selectedDate)) return;

    const dayRecords = getAttendanceForDate(selectedDate);
    const record = dayRecords.find((a) => a.prayer_name === prayerName);
    const newAttended = !(record?.attended || false);

    try {
      await togglePrayerAttendance(user.id, prayerName, selectedDate, newAttended);

      setAttendance((prev) => {
        const others = prev.filter(
          (a) => !(a.prayer_date === selectedDate && a.prayer_name === prayerName)
        );
        if (record) {
          return [...others, { ...record, attended: newAttended }];
        }
        return [
          ...others,
          {
            id: `temp-${Date.now()}`,
            prayer_name: prayerName,
            attended: newAttended,
            prayer_date: selectedDate,
            created_at: new Date().toISOString(),
          },
        ];
      });
    } catch (error) {
      console.error('Error toggling attendance:', error);
    }
  };

  const styles = makeStyles(colors);
  const todayStats = getTodayStats();
  const streak = getStreak();
  const overallRate = getOverallRate();
  const weekDates = getWeekDates();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerSubtitle}>Track your daily prayers</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.attendedCard }]}>
            <Flame size={24} color={colors.success} />
          </View>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.accentLight }]}>
            <TrendingUp size={24} color={colors.accent} />
          </View>
          <Text style={styles.statNumber}>{overallRate}%</Text>
          <Text style={styles.statLabel}>Overall Rate</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
            <Award size={24} color={colors.primary} />
          </View>
          <Text style={styles.statNumber}>
            {todayStats.attended}/{todayStats.total}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      {/* Weekly Calendar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.weekRow}>
          {weekDates.map((date) => {
            const dateStr = toDateString(date);
            const dayRecords = getAttendanceForDate(dateStr);
            const attended = dayRecords.filter((a) => a.attended).length;
            const isToday = dateStr === toDateString(new Date());
            const isSelected = dateStr === selectedDate;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayPill,
                  isSelected && styles.dayPillSelected,
                  isToday && !isSelected && styles.dayPillToday,
                ]}
                onPress={() => setSelectedDate(dateStr)}>
                <Text
                  style={[
                    styles.dayPillText,
                    isSelected && styles.dayPillTextSelected,
                  ]}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                </Text>
                <View
                  style={[
                    styles.dayIndicator,
                    attended === 5 && { backgroundColor: colors.success },
                    attended > 0 && attended < 5 && { backgroundColor: colors.accent },
                    attended === 0 && { backgroundColor: colors.border },
                  ]}
                />
                <Text style={styles.dayNumber}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Selected Day Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedDate === toDateString(new Date())
            ? "Today's Prayers"
            : new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
        </Text>
        <Text style={styles.editHint}>Tap after prayer time starts to mark attended or missed</Text>

        {PRAYER_NAMES.map((name) => {
          const dayRecords = getAttendanceForDate(selectedDate);
          const record = dayRecords.find((a) => a.prayer_name === name);
          const isAttended = record?.attended || false;
          const prayerTimes = getPrayerTimesForDate(selectedDate);
          const prayer = (prayerTimes as any)[name];
          const now = new Date();
          const todayStr = toDateString(now);
          const canToggle = canMarkPrayerAttendance(prayer.time, selectedDate, now);
          const isPast =
            selectedDate < todayStr ||
            (selectedDate === todayStr && prayer.time <= now);

          return (
            <TouchableOpacity
              key={name}
              style={[
                styles.prayerRow,
                isAttended && styles.prayerRowAttended,
                !isAttended && isPast && styles.prayerRowMissed,
                !canToggle && styles.prayerRowLocked,
              ]}
              disabled={!canToggle}
              onPress={() => handleTogglePrayer(name)}
              activeOpacity={0.7}>
              <View style={styles.prayerRowLeft}>
                {isAttended ? (
                  <CheckCircle2 size={22} color={colors.success} />
                ) : isPast ? (
                  <XCircle size={22} color={colors.error} />
                ) : (
                  <Circle size={22} color={colors.textMuted} />
                )}
                <Text style={styles.prayerRowName}>
                  {getPrayerDisplayLabel(name, parseDateString(selectedDate))}
                </Text>
              </View>
              <Text style={styles.prayerRowTime}>{prayer.timeString}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Overall Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryDot}>
              <CheckCircle2 size={16} color={colors.success} />
            </View>
            <Text style={styles.summaryText}>Total Attended</Text>
            <Text style={styles.summaryValue}>
              {attendance.filter((a) => a.attended).length}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryDot}>
              <XCircle size={16} color={colors.error} />
            </View>
            <Text style={styles.summaryText}>Total Missed</Text>
            <Text style={styles.summaryValue}>
              {attendance.filter((a) => !a.attended).length}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryDot}>
              <Calendar size={16} color={colors.primary} />
            </View>
            <Text style={styles.summaryText}>Days Tracked</Text>
            <Text style={styles.summaryValue}>
              {new Set(attendance.map((a) => a.prayer_date)).size}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    editHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    dayPill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    dayPillSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    dayPillToday: {
      borderColor: colors.accent,
    },
    dayPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    dayPillTextSelected: {
      color: colors.primary,
    },
    dayIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dayNumber: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    prayerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      marginBottom: 8,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prayerRowAttended: {
      backgroundColor: colors.attendedCard,
      borderColor: colors.success,
    },
    prayerRowMissed: {
      backgroundColor: colors.missedCard,
      borderColor: colors.error,
    },
    prayerRowLocked: {
      opacity: 0.55,
    },
    prayerRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    prayerRowName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    prayerRowTime: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    summaryDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    summaryText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 44,
    },
  });
}
