import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  CheckCircle,
  Home,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Settings,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/lib/themeContext';

const SIDEBAR_WIDTH = 272;
const MOBILE_BREAKPOINT = 768;

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/', label: 'Home', icon: Home },
  { href: '/attendance', label: 'Attendance', icon: CheckCircle },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/history', label: 'History', icon: List },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function normalizePath(path: string) {
  if (path === '/index' || path === '') return '/';
  return path;
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = normalizePath(usePathname());
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [open, setOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(isMobile ? -SIDEBAR_WIDTH : 0)).current;

  useEffect(() => {
    if (!isMobile) {
      slideAnim.setValue(0);
      setOpen(false);
    }
  }, [isMobile, slideAnim]);

  useEffect(() => {
    if (!isMobile) return;
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -SIDEBAR_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, isMobile, slideAnim]);

  const navigate = (href: string) => {
    router.push(href as never);
    if (isMobile) setOpen(false);
  };

  const activeItem =
    NAV_ITEMS.find((item) => normalizePath(item.href) === pathname) ?? NAV_ITEMS[0];

  const sidebar = (
    <View style={[styles.sidebarInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primaryLight }]}>
          <Moon size={22} color={colors.primary} />
        </View>
        <View style={styles.brandText}>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Prayer Tracker</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>Daily salah log</Text>
        </View>
        {isMobile ? (
          <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
            <X size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = normalizePath(item.href) === pathname;
          return (
            <TouchableOpacity
              key={item.href}
              style={[
                styles.navItem,
                active && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => navigate(item.href)}>
              <Icon size={20} color={active ? colors.primary : colors.textMuted} />
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? colors.primary : colors.textSecondary },
                  active && styles.navLabelActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {!isMobile ? (
        <View style={[styles.sidebarDesktop, { width: SIDEBAR_WIDTH, borderColor: colors.border }]}>
          {sidebar}
        </View>
      ) : (
        <>
          {open ? (
            <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
          ) : null}
          <Animated.View
            style={[
              styles.sidebarMobile,
              {
                width: SIDEBAR_WIDTH,
                paddingTop: insets.top,
                transform: [{ translateX: slideAnim }],
              },
            ]}>
            {sidebar}
          </Animated.View>
        </>
      )}

      <View style={styles.main}>
        {isMobile ? (
          <View
            style={[
              styles.mobileHeader,
              {
                paddingTop: insets.top + 13,
                backgroundColor: colors.header,
                borderBottomColor: colors.border,
              },
            ]}>
            <TouchableOpacity
              style={[styles.menuButton, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => setOpen(true)}>
              <Menu size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.mobileHeaderText}>
              <Text style={[styles.appName, { color: colors.text }]}>Prayer Tracker</Text>
              <Text style={[styles.pageName, { color: colors.textMuted }]}>{activeItem.label}</Text>
            </View>
            <View style={[styles.headerLogo, { backgroundColor: colors.primaryLight }]}>
              <Moon size={18} color={colors.primary} />
            </View>
          </View>
        ) : null}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarDesktop: {
    borderRightWidth: 1,
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  sidebarInner: {
    flex: 1,
    borderRightWidth: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 90,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  brandSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  navList: {
    padding: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  navLabelActive: {
    fontWeight: '700',
  },
  main: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 30,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileHeaderText: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pageName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});
