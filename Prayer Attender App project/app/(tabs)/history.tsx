import { useState, useEffect, useCallback } from 'react';
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
import { toDateString, formatHijriDate, togglePrayerAttendance, canMarkPrayerAttendance, onAttendanceUpdated } from '@/lib/attendance';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/notify';
import { AppSearchInput } from '@/components/AppTextInput';
import { getPrayerTimes, getPrayerDisplayLabel } from '@/lib/prayerTimes';
import { getPrayerCalcFromSettings } from '@/lib/location';
import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  Filter,
  Clock,
  ListChecks,
  Frown,
} from 'lucide-react-native';

interface AttendanceRecord {
  id: string;
  prayer_name: string;
  attended: boolean;
  prayer_date: string;
  created_at: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

interface FilteredDay {
  date: string;
  dayName: string;
  displayDate: string;
  hijriDate: string;
  prayers: {
    key: string;
    name: string;
    time: string;
    prayerTime: Date;
    attended: boolean;
  }[];
  attendedCount: number;
  totalCount: number;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'attended' | 'missed'>('all');
  const [settings, setSettings] = useState<any>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: settingsData } = await supabase
        .from('prayer_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setSettings(settingsData);

      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

      const { data } = await supabase
        .from('prayer_attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('prayer_date', startDate)
        .lte('prayer_date', endDate)
        .order('prayer_date', { ascending: false });

      setRecords(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user, loadData])
  );

  useEffect(() => {
    const unsubscribe = onAttendanceUpdated(() => {
      if (user) loadData();
    });
    return unsubscribe;
  }, [user, loadData]);

  const getDays = (): FilteredDay[] => {
    const days: FilteredDay[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const calc = getPrayerCalcFromSettings(settings);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dateStr = toDateString(date);
      const dayRecords = records.filter((r) => r.prayer_date === dateStr);

      if (dayRecords.length === 0 && filterType !== 'all') continue;

      const prayerTimes = getPrayerTimes(
        date,
        calc.latitude,
        calc.longitude,
        calc.method,
        calc.timezoneOffsetHours
      );
      const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((name) => {
        const record = dayRecords.find((r) => r.prayer_name === name);
        const entry = (prayerTimes as any)[name];
        return {
          key: name,
          name: getPrayerDisplayLabel(name, date),
          time: entry.timeString,
          prayerTime: entry.time as Date,
          attended: record?.attended || false,
        };
      });

      const attendedCount = prayers.filter((p) => p.attended).length;
      const totalCount = prayers.length;

      if (filterType === 'attended' && attendedCount === 0) continue;
      if (filterType === 'missed' && attendedCount === totalCount) continue;

      const hijriDate = formatHijriDate(date);

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        displayDate: date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        hijriDate,
        prayers,
        attendedCount,
        totalCount,
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return days.filter((d) =>
        d.date.includes(query) ||
        d.dayName.toLowerCase().includes(query) ||
        d.hijriDate.toLowerCase().includes(query)
      );
    }

    return days.filter((d) => d.prayers.length > 0);
  };

  const handleTogglePrayer = async (dateStr: string, prayerKey: string, prayerLabel: string, prayerTime: Date) => {
    if (!user) return;
    if (!canMarkPrayerAttendance(prayerTime, dateStr, now)) return;

    const existing = records.find(
      (r) => r.prayer_date === dateStr && r.prayer_name === prayerKey
    );
    const newAttended = !(existing?.attended || false);

    try {
      await togglePrayerAttendance(user.id, prayerKey, dateStr, newAttended);

      setRecords((prev) => {
        const others = prev.filter(
          (r) => !(r.prayer_date === dateStr && r.prayer_name === prayerKey)
        );
        if (existing) {
          return [...others, { ...existing, attended: newAttended }];
        }
        return [
          ...others,
          {
            id: `temp-${Date.now()}`,
            prayer_name: prayerKey,
            attended: newAttended,
            prayer_date: dateStr,
            created_at: new Date().toISOString(),
            latitude: settings?.latitude ?? 24.8607,
            longitude: settings?.longitude ?? 67.0011,
            city: settings?.city ?? 'Your City',
            country: settings?.country ?? 'Pakistan',
          },
        ];
      });

      toast({
        type: 'success',
        title: newAttended ? 'Marked attended' : 'Marked missed',
        message: `${prayerLabel} · ${dateStr}`,
      });
    } catch (error) {
      console.error('Error updating prayer:', error);
      toast({
        type: 'error',
        title: 'Update failed',
        message: 'Could not save this prayer. Try again.',
      });
    }
  };

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  };

  const filteredDays = getDays();
  const styles = makeStyles(colors);
  const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Prayer History</Text>
          <Text style={styles.headerSubtitle}>View all your prayers by date</Text>
        </View>

        {/* Search Bar */}
        <AppSearchInput
          icon={Search}
          placeholder="Search by date..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchBar}
        />

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToCurrentMonth}>
            <Text style={styles.monthTitle}>{monthName}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextMonth}>
            <ChevronRight size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('all')}>
            <ListChecks size={14} color={filterType === 'all' ? colors.primary : colors.textMuted} />
            <Text style={[
              styles.filterButtonText,
              filterType === 'all' && styles.filterButtonTextActive,
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'attended' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('attended')}>
            <CheckCircle2 size={14} color={filterType === 'attended' ? colors.success : colors.textMuted} />
            <Text style={[
              styles.filterButtonText,
              filterType === 'attended' && styles.filterButtonTextActive,
            ]}>Attended</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'missed' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType('missed')}>
            <XCircle size={14} color={filterType === 'missed' ? colors.error : colors.textMuted} />
            <Text style={[
              styles.filterButtonText,
              filterType === 'missed' && styles.filterButtonTextActive,
            ]}>Missed</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <View style={styles.resultsSection}>
          <Text style={styles.editHint}>Tap after prayer time starts to mark attended or missed</Text>
          {filteredDays.length === 0 ? (
            <View style={styles.emptyState}>
              <Frown size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No prayers found for this month</Text>
              <Text style={styles.emptySubtext}>Try a different month or filter</Text>
            </View>
          ) : (
            filteredDays.map((day, index) => (
              <View key={day.date} style={styles.dayCard}>
                {/* Day Header */}
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderLeft}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{day.dayName}</Text>
                    </View>
                    <View>
                      <Text style={styles.dayDate}>{day.displayDate}</Text>
                      <Text style={styles.dayHijri}>{day.hijriDate}</Text>
                    </View>
                  </View>
                  <View style={styles.dayHeaderRight}>
                    <Text style={styles.dayCount}>
                      {day.attendedCount}/{day.totalCount}
                    </Text>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(day.attendedCount / day.totalCount) * 100}%`,
                            backgroundColor: day.attendedCount === day.totalCount ? colors.success : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Prayers List */}
                <View style={styles.prayersList}>
                  {day.prayers.map((prayer) => {
                    const canToggle = canMarkPrayerAttendance(prayer.prayerTime, day.date, now);

                    return (
                    <TouchableOpacity
                      key={prayer.key}
                      style={[
                        styles.prayerItem,
                        prayer.attended && styles.prayerItemAttended,
                        !canToggle && styles.prayerItemLocked,
                      ]}
                      disabled={!canToggle}
                      onPress={() => handleTogglePrayer(day.date, prayer.key, prayer.name, prayer.prayerTime)}
                      activeOpacity={0.7}>
                      <View style={styles.prayerItemLeft}>
                        {prayer.attended ? (
                          <CheckCircle2 size={16} color={colors.success} />
                        ) : canToggle ? (
                          <XCircle size={16} color={colors.error} />
                        ) : (
                          <Circle size={16} color={colors.textMuted} />
                        )}
                        <Text style={styles.prayerItemName}>{prayer.name}</Text>
                      </View>
                      <Text style={styles.prayerItemTime}>{prayer.time}</Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
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
    searchBar: {
      marginHorizontal: 16,
      marginBottom: 12,
    },
    monthNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 16,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterButtonTextActive: {
      color: colors.primary,
    },
    resultsSection: {
      paddingHorizontal: 16,
    },
    editHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 12,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 16,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    dayCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dayHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dayBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    dayDate: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    dayHijri: {
      fontSize: 12,
      color: colors.islamicGold,
      marginTop: 2,
    },
    dayHeaderRight: {
      alignItems: 'flex-end',
    },
    dayCount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    progressBar: {
      width: 80,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 4,
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },
    prayersList: {
      gap: 8,
    },
    prayerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
    },
    prayerItemAttended: {
      backgroundColor: colors.attendedCard,
    },
    prayerItemLocked: {
      opacity: 0.55,
    },
    prayerItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prayerItemName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    prayerItemTime: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
