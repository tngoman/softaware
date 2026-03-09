/**
 * Centralized notification utility.
 *
 * Uses react-hot-toast for lightweight success / error / warning / info toasts.
 * SweetAlert2 is intentionally NOT used here — keep Swal only for confirmation
 * dialogs that require an explicit user decision (delete, discard, etc.).
 *
 * Usage:
 *   import { notify } from '../utils/notify';   // adjust path as needed
 *
 *   notify.success('Settings saved');
 *   notify.error('Failed to load data');
 *   notify.warning('File too large');
 *   notify.info('Check your email for a reset link');
 */
import toast from 'react-hot-toast';

/* ------------------------------------------------------------------ */
/*  Core helpers                                                       */
/* ------------------------------------------------------------------ */

/** Green check-mark toast — saved / created / updated / completed */
const success = (message: string) =>
  toast.success(message, { duration: 3000 });

/** Red cross toast — API errors, load failures, unexpected errors */
const error = (message: string) =>
  toast.error(message, { duration: 4000 });

/** Orange warning toast — validation issues, soft warnings */
const warning = (message: string) =>
  toast(message, {
    icon: '⚠️',
    duration: 4000,
    style: {
      border: '1px solid #f59e0b',
      background: '#fffbeb',
      color: '#92400e',
    },
  });

/** Blue info toast — neutral information */
const info = (message: string) =>
  toast(message, {
    icon: 'ℹ️',
    duration: 3500,
    style: {
      border: '1px solid #3b82f6',
      background: '#eff6ff',
      color: '#1e40af',
    },
  });

/* ------------------------------------------------------------------ */
/*  Promise helper (loading → success / error)                         */
/* ------------------------------------------------------------------ */

/**
 * Wraps an async operation with a loading → success / error toast.
 *
 *   notify.promise(saveSettings(), {
 *     loading: 'Saving…',
 *     success: 'Settings saved',
 *     error:   'Could not save settings',
 *   });
 */
const promise = <T>(
  p: Promise<T>,
  msgs: { loading: string; success: string; error: string },
) => toast.promise(p, msgs);

/* ------------------------------------------------------------------ */
/*  Export                                                              */
/* ------------------------------------------------------------------ */

export const notify = { success, error, warning, info, promise } as const;
export default notify;
