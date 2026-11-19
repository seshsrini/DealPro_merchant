package com.dealpro.merchant;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * One look on every Android phone.
 *
 *  1. Same layout width everywhere: on phones (screen <= 480dp wide) the WebView honours the
 *     page's viewport width (index.html, width=412), so every phone lays the app out at 412 CSS px
 *     and scales it to its screen. Screen width and the "Display size" setting no longer change the
 *     layout. Tablets keep device-width.
 *  2. Text zoom fixed at 100%: the phone's "Font size" setting doesn't enlarge the layout.
 *  3. Edge-to-edge on every Android version (Android 15+ forces it): the WebView's parent is padded
 *     by the status bar, navigation bar and display cutout, so no page is drawn under the clock or the
 *     gesture bar on any phone. Those areas take the app background (AppSystemBarsPlugin: light/dark).
 */
public class MainActivity extends BridgeActivity {
  static final int LIGHT_BG = Color.parseColor("#f8fafc"); // Tailwind slate-50, the app background
  static final int DARK_BG = Color.parseColor("#020617");  // slate-950 (dark theme)
  private View root;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AppSystemBarsPlugin.class);
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    WebView webView = getBridge().getWebView();
    WebSettings s = webView.getSettings();
    s.setTextZoom(100);
    float dpWidth = getResources().getConfiguration().smallestScreenWidthDp;
    if (dpWidth > 0 && dpWidth <= 480) {
      s.setUseWideViewPort(true);
      s.setLoadWithOverviewMode(true);
    }

    root = (View) webView.getParent();
    applyTheme(false);
    ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
      return WindowInsetsCompat.CONSUMED;
    });
  }

  /** Background behind the status/navigation bars, and dark or light bar icons to match. */
  void applyTheme(boolean dark) {
    if (root != null) root.setBackgroundColor(dark ? DARK_BG : LIGHT_BG);
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.setAppearanceLightStatusBars(!dark);
    c.setAppearanceLightNavigationBars(!dark);
  }
}
