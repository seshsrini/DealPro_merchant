import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Android only: the status/navigation bar area (reserved natively by MainActivity) takes the
 * app background, light or dark, with matching icons. No-op on the web.
 */
const AppSystemBars = registerPlugin<{ setDark(o: { dark: boolean }): Promise<void> }>('AppSystemBars');

export function syncSystemBars(dark: boolean) {
  if (Capacitor.getPlatform() !== 'android') return;
  AppSystemBars.setDark({ dark }).catch(() => { /* older APK without the plugin */ });
}
