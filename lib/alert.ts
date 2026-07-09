import { toast, confirm } from '@/lib/notify';

type AlertType = 'success' | 'error' | 'info' | 'warning';

export function showAlert(
  title: string,
  message: string,
  type: AlertType = 'info'
) {
  toast({ type, title, message });
}

export function showConfirmAlert(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: {
    confirmText?: string;
    cancelText?: string;
    icon?: 'success' | 'error' | 'warning' | 'question';
  }
) {
  confirm({
    title,
    message,
    confirmText: options?.confirmText,
    cancelText: options?.cancelText,
    icon: options?.icon ?? 'question',
    onConfirm,
  });
}
