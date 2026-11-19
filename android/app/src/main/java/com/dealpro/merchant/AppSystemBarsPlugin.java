package com.dealpro.merchant;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** AppSystemBars.setDark({ dark }) from the web app: status/navigation bar area follows the theme. */
@CapacitorPlugin(name = "AppSystemBars")
public class AppSystemBarsPlugin extends Plugin {
  @PluginMethod
  public void setDark(PluginCall call) {
    boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
    getActivity().runOnUiThread(() -> ((MainActivity) getActivity()).applyTheme(dark));
    call.resolve();
  }
}
