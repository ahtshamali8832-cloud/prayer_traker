import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/lib/themeContext';
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Star,
  Sun,
  Calendar as CalendarIcon,
} from 'lucide-react-native';

interface DayInfo {
  date: number;
  hijriDay: number;
  hijriMonth: string;
  hijriMonthIndex: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  gregorianDate: Date;
}

const HIJRI_MONTHS = [
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
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

const GREGORIAN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [days, setDays] = useState<DayInfo[]>([]);

  useEffect(() => {
    generateCalendarDays(currentDate);
  }, [currentDate]);

  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const daysArray: DayInfo[] = [];
    const today = new Date();

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const hijri = getHijriInfo(d);
      daysArray.push({
        date: prevMonthLastDay - i,
        hijriDay: hijri.day,
        hijriMonth: hijri.month,
        hijriMonthIndex: hijri.monthIndex,
        isToday: false,
        isCurrentMonth: false,
        gregorianDate: d,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const hijri = getHijriInfo(d);
      daysArray.push({
        date: i,
        hijriDay: hijri.day,
        hijriMonth: hijri.month,
        hijriMonthIndex: hijri.monthIndex,
        isToday: isSameDay(d, today),
        isCurrentMonth: true,
        gregorianDate: d,
      });
    }

    // Next month days
    const remaining = 42 - daysArray.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const hijri = getHijriInfo(d);
      daysArray.push({
        date: i,
        hijriDay: hijri.day,
        hijriMonth: hijri.month,
        hijriMonthIndex: hijri.monthIndex,
        isToday: false,
        isCurrentMonth: false,
        gregorianDate: d,
      });
    }

    setDays(daysArray);
  };

  const getHijriInfo = (date: Date) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
      });
      const parts = formatter.formatToParts(date);
      const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10);
      const monthPart = parts.find((p) => p.type === 'month')?.value ?? 'Muharram';

      let monthIndex = HIJRI_MONTHS.findIndex(
        (m) => m.toLowerCase() === monthPart.toLowerCase()
      );
      if (monthIndex < 0) {
        monthIndex = HIJRI_MONTHS.findIndex((m) =>
          monthPart.toLowerCase().includes(m.split(' ')[0].toLowerCase())
        );
      }
      if (monthIndex < 0) monthIndex = 0;

      return {
        day: Number.isNaN(day) ? 1 : day,
        month: HIJRI_MONTHS[monthIndex],
        monthIndex,
      };
    } catch {
      return { day: 1, month: 'Muharram', monthIndex: 0 };
    }
  };

  const isSameDay = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const selectedHijri = getHijriInfo(selectedDate);
  const calendarWeeks: DayInfo[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    calendarWeeks.push(days.slice(i, i + 7));
  }
  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Islamic Calendar</Text>
        <Text style={styles.headerSubtitle}>
          {GREGORIAN_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
      </View>

      {/* Selected Date Info */}
      <View style={styles.selectedDateCard}>
        <View style={styles.selectedDateLeft}>
          <Text style={styles.selectedDateGregorian}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <View style={styles.hijriRow}>
            <Moon size={16} color={colors.islamicGold} />
            <Text style={styles.selectedDateHijri}>
              {selectedHijri.day} {selectedHijri.month}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
          <CalendarIcon size={16} color={colors.primary} />
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navButton} onPress={goToPrevMonth}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {GREGORIAN_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekdayText}>
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarWeeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              const isSelected = isSameDay(day.gregorianDate, selectedDate);
              return (
                <TouchableOpacity
                  key={`${weekIndex}-${dayIndex}`}
                  style={[
                    styles.dayCell,
                    day.isToday && styles.dayCellToday,
                    isSelected && styles.dayCellSelected,
                    !day.isCurrentMonth && styles.dayCellOther,
                  ]}
                  onPress={() => setSelectedDate(day.gregorianDate)}>
                  <Text
                    style={[
                      styles.dayCellText,
                      day.isToday && styles.dayCellTextToday,
                      isSelected && styles.dayCellTextSelected,
                      !day.isCurrentMonth && styles.dayCellTextOther,
                    ]}>
                    {day.date}
                  </Text>
                  <Text
                    style={[
                      styles.dayCellHijri,
                      isSelected && styles.dayCellHijriSelected,
                      !day.isCurrentMonth && styles.dayCellTextOther,
                    ]}>
                    {day.hijriDay}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Hijri Month Info */}
      <View style={styles.hijriInfo}>
        <View style={styles.hijriInfoCard}>
          <Moon size={20} color={colors.islamicGold} />
          <View style={styles.hijriInfoText}>
            <Text style={styles.hijriInfoTitle}>
              {selectedHijri.month}
            </Text>
            <Text style={styles.hijriInfoSubtitle}>
              Islamic Month {selectedHijri.monthIndex + 1} of 12
            </Text>
          </View>
        </View>
      </View>

      {/* Important Dates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Important Dates</Text>
        {getImportantDates().map((item, index) => (
          <View key={index} style={styles.importantDateRow}>
            <View style={styles.importantDateIcon}>
              <Star size={14} color={colors.accent} />
            </View>
            <View style={styles.importantDateText}>
              <Text style={styles.importantDateName}>{item.name}</Text>
              <Text style={styles.importantDateDate}>{item.date}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function getImportantDates() {
  return [
    { name: 'Islamic New Year', date: '1 Muharram' },
    { name: 'Day of Ashura', date: '10 Muharram' },
    { name: 'Mawlid al-Nabi', date: '12 Rabi al-Awwal' },
    { name: 'Isra and Miraj', date: '27 Rajab' },
    { name: 'Beginning of Ramadan', date: '1 Ramadan' },
    { name: 'Laylat al-Qadr', date: '27 Ramadan' },
    { name: 'Eid al-Fitr', date: '1 Shawwal' },
    { name: 'Hajj Begins', date: '8 Dhu al-Hijjah' },
    { name: 'Day of Arafah', date: '9 Dhu al-Hijjah' },
    { name: 'Eid al-Adha', date: '10 Dhu al-Hijjah' },
  ];
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
    selectedDateCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectedDateLeft: {
      flex: 1,
    },
    selectedDateGregorian: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    hijriRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    selectedDateHijri: {
      fontSize: 14,
      color: colors.islamicGold,
      fontWeight: '600',
    },
    todayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.primaryLight,
      borderRadius: 10,
    },
    todayButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    monthNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    navButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    weekdayText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    calendarGrid: {
      paddingHorizontal: 16,
      gap: 4,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dayCell: {
      flex: 1,
      minWidth: 0,
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayCellToday: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayCellOther: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: 'transparent',
    },
    dayCellText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    dayCellTextToday: {
      color: colors.accent,
    },
    dayCellTextSelected: {
      color: '#FFFFFF',
    },
    dayCellTextOther: {
      color: colors.textMuted,
    },
    dayCellHijri: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    dayCellHijriSelected: {
      color: '#FFFFFF',
    },
    hijriInfo: {
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
    },
    hijriInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hijriInfoText: {
      flex: 1,
    },
    hijriInfoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    hijriInfoSubtitle: {
      fontSize: 13,
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
      marginBottom: 12,
    },
    importantDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    importantDateIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    importantDateText: {
      flex: 1,
    },
    importantDateName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    importantDateDate: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}
