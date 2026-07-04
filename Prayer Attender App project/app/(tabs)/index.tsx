import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import {
  getPrayerTimes,
  DailyPrayerTimes,
  PrayerTime,
  getNextPrayer,
  getActivePrayer,
  getTimeUntilPrayer,
  PRAYER_NAMES,
} from '@/lib/prayerTimes';
import { supabase } from '@/lib/supabase';
import { togglePrayerAttendance, toDateString, isToday, parseDateString, canMarkPrayerAttendance, onAttendanceUpdated } from '@/lib/attendance';
import { getPrayerCalcFromSettings, loadUserPrayerSettings, maybeSyncLocationInBackground, onLocationUpdated } from '@/lib/location';
import { Audio } from 'expo-av';
import {
  Moon,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Bell,
  BellOff,
  CheckCircle2,
  Circle,
  CircleDot,
  TrendingUp,
} from 'lucide-react-native';

interface AttendanceRecord {
  id: string;
  prayer_name: string;
  attended: boolean;
  prayer_date: string;
}

interface PrayerSettings {
  id: string;
  latitude: number;
  longitude: number;
  timezone: string;
  calculation_method: string;
  city: string;
  country: string;
  sound_enabled: boolean;
}

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const [prayerTimes, setPrayerTimes] = useState<DailyPrayerTimes | null>(null);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [timeUntil, setTimeUntil] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const hasLoadedRef = useRef(false);
  const todayStr = toDateString(new Date());
  const viewingToday = isToday(selectedDate);
  const activePrayer =
    viewingToday && prayerTimes ? getActivePrayer(prayerTimes, currentTime) : null;

  // Current time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sound check timer
  useEffect(() => {
    const timer = setInterval(() => {
      checkPrayerTimes();
    }, 60000);
    return () => clearInterval(timer);
  }, [prayerTimes, settings, soundPlayed]);

  const loadData = useCallback(async (showLoader = !hasLoadedRef.current) => {
    if (!user) return;
    try {
      if (showLoader) setLoading(true);

      const settingsData = await loadUserPrayerSettings(user.id);
      maybeSyncLocationInBackground(user.id);

      if (settingsData) {
        setSettings(settingsData);
      }

      const { data: attendanceData } = await supabase
        .from('prayer_attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('prayer_date', selectedDate);

      const attMap: Record<string, boolean> = {};
      attendanceData?.forEach((record) => {
        attMap[record.prayer_name] = record.attended;
      });
      setAttendance(attMap);

      const calc = getPrayerCalcFromSettings(settingsData);
      const times = getPrayerTimes(
        parseDateString(selectedDate),
        calc.latitude,
        calc.longitude,
        calc.method,
        calc.timezoneOffsetHours
      );
      times.fajr.attended = attMap.fajr || false;
      times.dhuhr.attended = attMap.dhuhr || false;
      times.asr.attended = attMap.asr || false;
      times.maghrib.attended = attMap.maghrib || false;
      times.isha.attended = attMap.isha || false;

      setPrayerTimes(times);
      if (isToday(selectedDate)) {
        setNextPrayer(getNextPrayer(times));
      } else {
        setNextPrayer(null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [user, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData(!hasLoadedRef.current);
    }, [user, selectedDate, loadData])
  );

  useEffect(() => {
    const unsubscribe = onLocationUpdated(() => {
      if (user) loadData(false);
    });
    return unsubscribe;
  }, [user, loadData]);

  useEffect(() => {
    const unsubscribe = onAttendanceUpdated(() => {
      if (user) loadData(false);
    });
    return unsubscribe;
  }, [user, loadData]);

  const checkPrayerTimes = async () => {
    if (!viewingToday || !prayerTimes || !settings?.sound_enabled) return;

    const now = new Date();
    const prayers = [prayerTimes.fajr, prayerTimes.dhuhr, prayerTimes.asr, prayerTimes.maghrib, prayerTimes.isha];

    for (const prayer of prayers) {
      const diff = Math.abs(now.getTime() - prayer.time.getTime());
      if (diff < 60000 && !soundPlayed[prayer.name]) {
        try {
          await playAzan();
          setSoundPlayed((prev) => ({ ...prev, [prayer.name]: true }));
        } catch (e) {
          console.error('Sound error:', e);
        }
      }
    }
  };

  const playAzan = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.islamcan.com/audio/adhan/azan1.mp3' },
        { shouldPlay: true }
      );
      await sound.playAsync();
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const toggleAttendance = async (prayerName: string) => {
    if (!user || !prayerTimes) return;
    const prayer = (prayerTimes as any)[prayerName] as PrayerTime;
    if (!canMarkPrayerAttendance(prayer.time, selectedDate, currentTime)) return;

    const newAttended = !attendance[prayerName];

    try {
      await togglePrayerAttendance(user.id, prayerName, selectedDate, newAttended);

      setAttendance((prev) => ({ ...prev, [prayerName]: newAttended }));
      if (prayerTimes) {
        const updated = { ...prayerTimes };
        (updated as any)[prayerName].attended = newAttended;
        setPrayerTimes(updated);
      }
    } catch (error) {
      console.error('Error toggling attendance:', error);
    }
  };

  const goToPrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateString(d));
  };

  const goToNextDay = () => {
    if (selectedDate >= todayStr) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toDateString(d));
  };

  const goToToday = () => setSelectedDate(todayStr);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getPrayerStatus = (prayer: PrayerTime) => {
    if (selectedDate > todayStr) return 'upcoming';
    if (selectedDate < todayStr) {
      return attendance[prayer.name] ? 'attended' : 'missed';
    }
    const now = new Date();
    if (prayer.time > now) return 'upcoming';
    if (attendance[prayer.name]) return 'attended';
    return 'missed';
  };

  const getAttendanceRate = () => {
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const now = new Date();
    let passedCount = 0;
    let attendedCount = 0;

    if (!prayerTimes) return 0;

    prayers.forEach((name) => {
      const time = (prayerTimes as any)[name].time;
      if (selectedDate < todayStr || time <= now) {
        passedCount++;
        if (attendance[name]) attendedCount++;
      }
    });

    return passedCount === 0 ? 0 : Math.round((attendedCount / passedCount) * 100);
  };

  const styles = makeStyles(colors);
  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const formattedDate = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading && !settings) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Loading prayer times...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Prayer Attender</Text>
            <View style={styles.headerSubtitleRow}>
              <MapPin size={14} color={colors.textMuted} style={styles.headerSubtitleIcon} />
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {settings?.city || 'Detecting...'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {settings?.sound_enabled ? (
              <Bell size={20} color={colors.primary} />
            ) : (
              <BellOff size={20} color={colors.textMuted} />
            )}
          </View>
        </View>

        {/* Date Navigator */}
        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.dateNavBtn} onPress={goToPrevDay}>
            <ChevronLeft size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.dateNavCenter}>
            <Text style={styles.dateNavText}>{formattedDate}</Text>
            {!viewingToday && (
              <TouchableOpacity onPress={goToToday}>
                <Text style={styles.todayLink}>Go to Today</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.dateNavBtn, selectedDate >= todayStr && styles.dateNavBtnDisabled]}
            onPress={goToNextDay}
            disabled={selectedDate >= todayStr}>
            <ChevronRight
              size={22}
              color={selectedDate >= todayStr ? colors.textMuted : colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Hijri Date */}
        {prayerTimes?.hijriDate && (
          <View style={styles.hijriBadge}>
            <Moon size={16} color={colors.islamicGold} />
            <Text style={styles.hijriText}>{prayerTimes.hijriDate}</Text>
          </View>
        )}

        {/* Next Prayer Card (only when no prayer is active) */}
        {viewingToday && !activePrayer && nextPrayer ? (
          <View style={styles.nextPrayerCardMuted}>
            <View style={styles.nextPrayerLeft}>
              <Text style={styles.nextPrayerLabel}>Next Prayer</Text>
              <Text style={styles.nextPrayerName}>{nextPrayer.label}</Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.timeString}</Text>
            </View>
            <View style={styles.nextPrayerRight}>
              <Clock size={20} color={colors.textMuted} />
              <Text style={styles.countdownMuted}>
                {getTimeUntilPrayer(nextPrayer.time)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Attendance Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <TrendingUp size={20} color={colors.primary} />
            <Text style={styles.statValue}>{getAttendanceRate()}%</Text>
            <Text style={styles.statLabel}>{viewingToday ? "Today's Rate" : 'Day Rate'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <CheckCircle2 size={20} color={colors.success} />
            <Text style={styles.statValue}>
              {Object.values(attendance).filter(Boolean).length}/5
            </Text>
            <Text style={styles.statLabel}>Prayers Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statItem, styles.statItemLocation]}>
            <MapPin size={20} color={colors.accent} />
            <Text
              style={[styles.statValue, styles.statValueLocation]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {settings?.city || 'Detecting...'}
            </Text>
            <Text style={styles.statLabel}>Location</Text>
          </View>
        </View>
      </View>

      {/* Prayer Times */}
      <View style={styles.prayersSection}>
        <Text style={styles.sectionTitle}>
          {viewingToday ? "Today's Prayers" : 'Prayers'}
        </Text>
        <Text style={styles.sectionHint}>
          Tap a prayer after its time starts to mark attended or missed
        </Text>
        {prayerTimes &&
          PRAYER_NAMES.map((name) => {
            const prayer = (prayerTimes as any)[name] as PrayerTime;
            const status = getPrayerStatus(prayer);
            const isActive = viewingToday && activePrayer?.name === name;
            const canToggle = canMarkPrayerAttendance(prayer.time, selectedDate, currentTime);

            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.prayerCard,
                  isActive && styles.prayerCardActive,
                  !isActive && status === 'attended' && styles.prayerCardAttended,
                  !isActive && status === 'missed' && styles.prayerCardMissed,
                  !canToggle && styles.prayerCardLocked,
                ]}
                disabled={!canToggle}
                onPress={() => toggleAttendance(name)}>
                <View style={styles.prayerLeft}>
                  <View style={styles.prayerIcon}>
                    {status === 'attended' ? (
                      <CheckCircle2 size={22} color={colors.success} />
                    ) : status === 'missed' ? (
                      <Circle size={22} color={colors.error} />
                    ) : (
                      <CircleDot size={22} color={colors.textMuted} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.prayerName}>{prayer.label}</Text>
                    <Text style={styles.prayerStatus}>
                      {isActive
                        ? 'Prayer time now'
                        : status === 'attended'
                          ? 'Attended'
                          : status === 'missed'
                            ? 'Missed'
                            : 'Upcoming'}
                    </Text>
                  </View>
                </View>
                <View style={styles.prayerRight}>
                  <Text style={styles.prayerTime}>{prayer.timeString}</Text>
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* Current Time */}
      {viewingToday && (
      <View style={styles.footer}>
        <Text style={styles.currentTime}>
          {currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })}
        </Text>
        <Text style={styles.footerText}>
          {settings?.calculation_method || 'Karachi'} Method
        </Text>
      </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: colors.header,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      padding: 8,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSubtitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
      marginTop: 4,
      paddingRight: 8,
    },
    headerSubtitleIcon: {
      marginTop: 2,
    },
    headerSubtitle: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    hijriBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 20,
      alignSelf: 'flex-start',
    },
    hijriText: {
      fontSize: 13,
      color: colors.islamicGold,
      fontWeight: '600',
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      gap: 8,
    },
    dateNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateNavBtnDisabled: {
      opacity: 0.4,
    },
    dateNavCenter: {
      flex: 1,
      alignItems: 'center',
    },
    dateNavText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    todayLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 4,
    },
    nextPrayerCard: {
      marginTop: 16,
      padding: 20,
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    nextPrayerCardMuted: {
      marginTop: 16,
      padding: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextPrayerLeft: {
      flex: 1,
    },
    nextPrayerLabel: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    nextPrayerName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 4,
    },
    nextPrayerTime: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 2,
    },
    nextPrayerRight: {
      alignItems: 'center',
      paddingLeft: 16,
    },
    countdown: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 4,
    },
    countdownMuted: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 4,
    },
    statsCard: {
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
    },
    statItemLocation: {
      paddingHorizontal: 2,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    statValueLocation: {
      fontSize: 12,
      lineHeight: 16,
      width: '100%',
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
    },
    prayersSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
    },
    prayerCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prayerCardActive: {
      borderColor: colors.islamicGold,
      borderWidth: 2,
    },
    prayerCardAttended: {
      backgroundColor: colors.attendedCard,
      borderColor: colors.success,
    },
    prayerCardMissed: {
      backgroundColor: colors.missedCard,
      borderColor: colors.error,
    },
    prayerCardLocked: {
      opacity: 0.55,
    },
    prayerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    prayerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    prayerName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    prayerStatus: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    prayerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prayerTime: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    footer: {
      padding: 20,
      alignItems: 'center',
    },
    currentTime: {
      fontSize: 32,
      fontWeight: '300',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
  });
}
