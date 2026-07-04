import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { toDateString, getAttendanceStatsForRange, getPerPrayerStatsForMonth, getDayAttendanceStats, getMonthPerformanceLabel, getDaysInMonth } from '@/lib/attendance';
import {
  getPrayerTimes,
  getNextPrayer,
  getTimeUntilPrayer,
  PRAYER_NAMES,
} from '@/lib/prayerTimes';
import { getPrayerCalcFromSettings, loadUserPrayerSettings, maybeSyncLocationInBackground, onLocationUpdated } from '@/lib/location';
import { MonthYearWheelPicker, MonthYearWheelPickerHandle } from '@/components/WheelPicker';
import {
  LayoutDashboard,
  Flame,
  TrendingUp,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react-native';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PERF_YEAR_START = 1934;

interface AttendanceRecord {
  prayer_name: string;
  attended: boolean;
  prayer_date: string;
}

interface PrayerSettings {
  latitude: number;
  longitude: number;
  calculation_method: string;
  city: string;
  country: string;
}

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const nowInit = new Date();
  const [perfMonth, setPerfMonth] = useState(nowInit.getMonth());
  const [perfYear, setPerfYear] = useState(nowInit.getFullYear());
  const [draftMonth, setDraftMonth] = useState(nowInit.getMonth());
  const [draftYear, setDraftYear] = useState(nowInit.getFullYear());
  const [perfFilterModalVisible, setPerfFilterModalVisible] = useState(false);
  const wheelPickerRef = useRef<MonthYearWheelPickerHandle>(null);

  const loadData = useCallback(async (showLoader = !hasLoadedRef.current) => {
    if (!user) return;
    try {
      if (showLoader) setLoading(true);

      const settingsData = await loadUserPrayerSettings(user.id);
      maybeSyncLocationInBackground(user.id);

      if (settingsData) {
        setSettings({
          latitude: settingsData.latitude,
          longitude: settingsData.longitude,
          calculation_method: settingsData.calculation_method,
          city: settingsData.city,
          country: settingsData.country,
        });
      }

      const today = new Date();
      const perfStart = new Date(perfYear, perfMonth, 1);
      const perfEnd = new Date(perfYear, perfMonth + 1, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      const filteredWeekStart = new Date(perfYear, perfMonth, Math.max(1, perfEnd.getDate() - 6));

      const rangeStart = new Date(
        Math.min(perfStart.getTime(), thirtyDaysAgo.getTime(), weekStart.getTime(), filteredWeekStart.getTime())
      );
      const startDate = toDateString(rangeStart);
      const isCurrentMonth =
        perfYear === today.getFullYear() && perfMonth === today.getMonth();
      const endDate = toDateString(isCurrentMonth ? today : perfEnd);

      const { data } = await supabase
        .from('prayer_attendance')
        .select('prayer_name, attended, prayer_date')
        .eq('user_id', user.id)
        .gte('prayer_date', startDate)
        .lte('prayer_date', endDate)
        .order('prayer_date', { ascending: false });

      setAttendance(data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [user, perfMonth, perfYear]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData(!hasLoadedRef.current);
    }, [user, loadData])
  );

  useEffect(() => {
    const unsubscribe = onLocationUpdated(() => {
      if (user) loadData(false);
    });
    return unsubscribe;
  }, [user, loadData]);

  useEffect(() => {
    if (!user || !hasLoadedRef.current) return;
    loadData(false);
  }, [perfMonth, perfYear, user, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const calc = getPrayerCalcFromSettings(settings);
  const now = new Date();

  const getTimesForDate = useCallback(
    (date: Date) =>
      getPrayerTimes(date, calc.latitude, calc.longitude, calc.method, calc.timezoneOffsetHours),
    [calc.latitude, calc.longitude, calc.method, calc.timezoneOffsetHours]
  );

  const today = toDateString(now);
  const todayStats = getDayAttendanceStats(attendance, getTimesForDate, today, now);
  const todayAttended = todayStats.attended;

  const getRateForRange = (days: number) =>
    getAttendanceStatsForRange(attendance, getTimesForDate, days, now).rate;

  const getStreak = () => {
    let streak = 0;
    const check = new Date(now);

    while (true) {
      const dateStr = toDateString(check);
      const day = getDayAttendanceStats(attendance, getTimesForDate, dateStr, now);
      const isPastDay = dateStr < today;
      const dayComplete = isPastDay ? day.attended === 5 : day.eligible > 0 && day.attended === day.eligible;

      if (!dayComplete) break;

      streak++;
      check.setDate(check.getDate() - 1);
    }

    return streak;
  };

  const getWeekDays = () => {
    const days: { label: string; date: string; rate: number }[] = [];
    const isCurrentMonth = perfYear === now.getFullYear() && perfMonth === now.getMonth();
    const daysInMonth = getDaysInMonth(perfYear, perfMonth);
    const endDay = isCurrentMonth ? now.getDate() : daysInMonth;
    const startDay = Math.max(1, endDay - 6);
    const refNow = isCurrentMonth
      ? now
      : new Date(perfYear, perfMonth, daysInMonth, 23, 59, 59, 999);

    for (let day = startDay; day <= endDay; day++) {
      const d = new Date(perfYear, perfMonth, day);
      const dateStr = toDateString(d);
      const dayStats = getDayAttendanceStats(attendance, getTimesForDate, dateStr, refNow);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        rate: dayStats.rate,
      });
    }
    return days;
  };

  const getPrayerBreakdown = () => {
    const stats = getPerPrayerStatsForMonth(attendance, getTimesForDate, perfYear, perfMonth, now);
    return PRAYER_NAMES.map((name) => ({
      name,
      label: PRAYER_LABELS[name],
      rate: stats[name].rate,
      attended: stats[name].attended,
      total: stats[name].eligible,
    }));
  };


  const perfMonthLabel = getMonthPerformanceLabel(perfYear, perfMonth, now);
  const yearOptions: number[] = [];
  for (let y = now.getFullYear(); y >= PERF_YEAR_START; y--) {
    yearOptions.push(y);
  }
  const yearLabels = yearOptions.map(String);
  const draftYearIndex = Math.max(0, yearOptions.indexOf(draftYear));

  const isDraftMonthDisabled = (index: number) =>
    draftYear > now.getFullYear() ||
    (draftYear === now.getFullYear() && index > now.getMonth());

  const handleDraftYearChange = (index: number) => {
    const year = yearOptions[index];
    setDraftYear(year);
    const maxMonth = year === now.getFullYear() ? now.getMonth() : 11;
    setDraftMonth((month) => (month > maxMonth ? maxMonth : month));
  };

  const openPerfFilterModal = () => {
    setDraftMonth(perfMonth);
    setDraftYear(perfYear);
    setPerfFilterModalVisible(true);
  };

  const applyPerformanceFilter = () => {
    const monthIndex = wheelPickerRef.current?.getMonthIndex() ?? draftMonth;
    const yearIndex = wheelPickerRef.current?.getYearIndex() ?? draftYearIndex;
    const year = yearOptions[yearIndex] ?? draftYear;
    setPerfMonth(monthIndex);
    setPerfYear(year);
    setDraftMonth(monthIndex);
    setDraftYear(year);
    setPerfFilterModalVisible(false);
  };

  const prayerTimes = getTimesForDate(now);
  const nextPrayer = getNextPrayer(prayerTimes);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const styles = makeStyles(colors);
  const weekDays = getWeekDays();
  const prayerBreakdown = getPrayerBreakdown();
  const streak = getStreak();

  if (loading && !settings) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.userName}>
              {user?.email?.split('@')[0] || 'User'}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <LayoutDashboard size={24} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        {settings?.city && (
          <Text style={styles.locationText}>
            {settings.city}, {settings.country}
          </Text>
        )}
      </View>

      {nextPrayer && (
        <View style={styles.nextPrayerBanner}>
          <View style={styles.nextPrayerInfo}>
            <Clock size={18} color={colors.primary} />
            <View>
              <Text style={styles.nextPrayerLabel}>Next: {nextPrayer.label}</Text>
              <Text style={styles.nextPrayerTime}>
                {nextPrayer.timeString} · {getTimeUntilPrayer(nextPrayer.time)}
              </Text>
            </View>
          </View>
          <Link href="/(tabs)" asChild>
            <TouchableOpacity style={styles.viewBtn}>
              <Text style={styles.viewBtnText}>View</Text>
              <ChevronRight size={16} color={colors.primary} />
            </TouchableOpacity>
          </Link>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <CheckCircle2 size={22} color={colors.success} />
          <Text style={styles.statValue}>{todayAttended}/5</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingUp size={22} color={colors.primary} />
          <Text style={styles.statValue}>{getRateForRange(7)}%</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <CalendarDays size={22} color={colors.accent} />
          <Text style={styles.statValue}>{getRateForRange(30)}%</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Flame size={22} color="#F97316" />
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Progress</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartBars}>
            {weekDays.map((day) => (
              <View key={day.date} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(day.rate, 4)}%`,
                        backgroundColor:
                          day.rate >= 80
                            ? colors.success
                            : day.rate >= 50
                            ? colors.primary
                            : day.rate > 0
                            ? colors.accent
                            : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{day.label}</Text>
                <Text style={styles.barRate}>{day.rate}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Prayer Performance</Text>
            <Text style={styles.sectionSubtitle}>
              {perfMonthLabel} · after prayer time starts
            </Text>
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={openPerfFilterModal}>
            <Filter size={16} color={colors.primary} />
            <Text style={styles.filterBtnText}>Filter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.breakdownCard}>
          {prayerBreakdown.map((prayer) => (
            <View key={prayer.name} style={styles.breakdownRow}>
              <View style={styles.breakdownNameCol}>
                <Text style={styles.breakdownName}>{prayer.label}</Text>
                <Text style={styles.breakdownCount}>
                  {prayer.attended}/{prayer.total}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${prayer.rate}%`,
                      backgroundColor:
                        prayer.rate >= 80
                          ? colors.success
                          : prayer.rate >= 50
                          ? colors.primary
                          : colors.success,
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownRate}>{prayer.rate}%</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          {todayAttended === 5 ? (
            <CheckCircle2 size={20} color={colors.success} />
          ) : (
            <XCircle size={20} color={colors.accent} />
          )}
          <Text style={styles.summaryText}>
            {todayAttended === 5
              ? 'All prayers completed today! MashaAllah'
              : `${5 - todayAttended} prayer${5 - todayAttended === 1 ? '' : 's'} remaining today`}
          </Text>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>

    <Modal
      visible={perfFilterModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPerfFilterModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPerfFilterModalVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderSpacer} />
            <Text style={styles.modalTitle}>Select Month Year</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setPerfFilterModalVisible(false)}>
              <X size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.wheelPickerWrap}>
            <MonthYearWheelPicker
              ref={wheelPickerRef}
              months={MONTH_NAMES}
              years={yearLabels}
              monthIndex={draftMonth}
              yearIndex={draftYearIndex}
              onMonthChange={setDraftMonth}
              onYearChange={handleDraftYearChange}
              isMonthDisabled={isDraftMonthDisabled}
              accentColor={colors.primary}
              textColor={colors.text}
              mutedColor={colors.textMuted}
              backgroundColor={colors.card}
            />
          </View>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={applyPerformanceFilter}
            activeOpacity={0.85}>
            <Text style={styles.applyBtnText}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    greeting: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    userName: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 8,
    },
    locationText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 4,
    },
    nextPrayerBanner: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    nextPrayerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    nextPrayerLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    nextPrayerTime: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    viewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.card,
      borderRadius: 8,
    },
    viewBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 8,
    },
    statCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    sectionHeaderText: {
      flex: 1,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    filterBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 0,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderRadius: 16,
      width: '88%',
      maxWidth: 360,
      maxHeight: '52%',
      paddingBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
    },
    modalHeaderSpacer: {
      width: 28,
    },
    modalTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    modalCloseBtn: {
      width: 28,
      alignItems: 'flex-end',
      padding: 2,
    },
    wheelPickerWrap: {
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    applyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginHorizontal: 12,
      marginTop: 4,
    },
    applyBtnMuted: {
      backgroundColor: colors.surfaceSecondary,
    },
    applyBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    applyBtnTextMuted: {
      color: colors.textMuted,
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 140,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
    },
    barTrack: {
      width: 28,
      height: 100,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 6,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: 6,
      minHeight: 4,
    },
    barLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 6,
      fontWeight: '600',
    },
    barRate: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
    },
    breakdownCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    breakdownNameCol: {
      width: 64,
    },
    breakdownName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    breakdownCount: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    progressTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    breakdownRate: {
      width: 36,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'right',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    actionCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    summaryCard: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    summaryText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
}
