import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/lib/themeContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type AlertIcon = 'success' | 'error' | 'warning' | 'question';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: AlertIcon;
  onConfirm: () => void | Promise<void>;
}

interface NotifyApi {
  toast: (options: { type?: ToastType; title: string; message?: string }) => void;
  confirm: (options: ConfirmOptions) => void;
}

const NotifyContext = createContext<NotifyApi | null>(null);

let notifyApi: NotifyApi | null = null;

export function toast(options: { type?: ToastType; title: string; message?: string }) {
  notifyApi?.toast(options);
}

export function confirm(options: ConfirmOptions) {
  notifyApi?.confirm(options);
}

function ToastIcon({ type, color }: { type: ToastType; color: string }) {
  const size = 20;
  if (type === 'success') return <CheckCircle2 size={size} color={color} />;
  if (type === 'error') return <AlertCircle size={size} color={color} />;
  if (type === 'warning') return <AlertTriangle size={size} color={color} />;
  return <HelpCircle size={size} color={color} />;
}

function SweetIcon({ icon, color }: { icon: AlertIcon; color: string }) {
  const size = 44;
  if (icon === 'success') return <CheckCircle2 size={size} color={color} />;
  if (icon === 'error') return <AlertCircle size={size} color={color} />;
  if (icon === 'warning') return <AlertTriangle size={size} color={color} />;
  return <HelpCircle size={size} color={color} />;
}

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const toastId = useRef(0);
  const fadeAnims = useRef<Record<number, Animated.Value>>({});

  const removeToast = useCallback((id: number) => {
    const anim = fadeAnims.current[id];
    if (!anim) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete fadeAnims.current[id];
    });
  }, []);

  const showToast = useCallback(
    (options: { type?: ToastType; title: string; message?: string }) => {
      const id = ++toastId.current;
      fadeAnims.current[id] = new Animated.Value(0);

      setToasts((prev) => [...prev.slice(-2), { id, type: options.type ?? 'info', title: options.title, message: options.message }]);

      requestAnimationFrame(() => {
        Animated.spring(fadeAnims.current[id], {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
        }).start();
      });

      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmState(options);
    setConfirmLoading(false);
  }, []);

  const api = useRef<NotifyApi>({
    toast: showToast,
    confirm: showConfirm,
  });

  useEffect(() => {
    api.current = { toast: showToast, confirm: showConfirm };
    notifyApi = api.current;
    return () => {
      notifyApi = null;
    };
  }, [showToast, showConfirm]);

  const toastColors: Record<ToastType, string> = {
    success: colors.success,
    error: colors.error,
    warning: colors.accent,
    info: colors.primary,
  };

  const confirmIcon = confirmState?.icon ?? 'question';
  const confirmColor =
    confirmIcon === 'success'
      ? colors.success
      : confirmIcon === 'error'
        ? colors.error
        : confirmIcon === 'warning'
          ? colors.accent
          : colors.primary;

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      await confirmState.onConfirm();
    } finally {
      setConfirmLoading(false);
      setConfirmState(null);
    }
  };

  return (
    <NotifyContext.Provider value={api.current}>
      {children}

      <View pointerEvents="box-none" style={styles.toastHost}>
        {toasts.map((item) => {
          const anim = fadeAnims.current[item.id] ?? new Animated.Value(1);
          return (
            <Animated.View
              key={item.id}
              style={[
                styles.toast,
                {
                  backgroundColor: colors.card,
                  borderColor: toastColors[item.type],
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-12, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <ToastIcon type={item.type} color={toastColors[item.type]} />
              <View style={styles.toastContent}>
                <Text style={[styles.toastTitle, { color: colors.text }]}>{item.title}</Text>
                {item.message ? (
                  <Text style={[styles.toastMessage, { color: colors.textSecondary }]}>
                    {item.message}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removeToast(item.id)} hitSlop={8}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Modal transparent visible={!!confirmState} animationType="fade" onRequestClose={() => setConfirmState(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => !confirmLoading && setConfirmState(null)}>
          <Pressable
            style={[styles.sweetAlert, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sweetIconWrap, { backgroundColor: `${confirmColor}22` }]}>
              <SweetIcon icon={confirmIcon} color={confirmColor} />
            </View>
            <Text style={[styles.sweetTitle, { color: colors.text }]}>{confirmState?.title}</Text>
            <Text style={[styles.sweetMessage, { color: colors.textSecondary }]}>
              {confirmState?.message}
            </Text>
            <View style={styles.sweetActions}>
              <TouchableOpacity
                style={[styles.sweetBtn, styles.sweetCancel, { borderColor: colors.border }]}
                disabled={confirmLoading}
                onPress={() => setConfirmState(null)}>
                <Text style={[styles.sweetCancelText, { color: colors.textSecondary }]}>
                  {confirmState?.cancelText ?? 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sweetBtn,
                  styles.sweetConfirm,
                  { backgroundColor: confirmIcon === 'error' ? colors.error : colors.primary },
                ]}
                disabled={confirmLoading}
                onPress={() => void handleConfirm()}>
                <Text style={styles.sweetConfirmText}>
                  {confirmLoading ? 'Please wait...' : confirmState?.confirmText ?? 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used within NotifyProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastHost: {
    position: 'absolute',
    top: 16,
    right: 16,
    left: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
    gap: 10,
  },
  toast: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  toastContent: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sweetAlert: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  sweetIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sweetTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  sweetMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  sweetActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  sweetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sweetCancel: {
    borderWidth: 1,
  },
  sweetConfirm: {},
  sweetCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sweetConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
