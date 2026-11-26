package app.masirkonkur.twa;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetData {
    public static final String PREFS = "masir_widgets";
    public static final String KEY_SNAPSHOT = "snapshot";

    public static final Class<?>[] PROVIDERS = new Class<?>[]{
            TodayWidgetProvider.class,
            WeekWidgetProvider.class,
            WeekTrendWidgetProvider.class,
            MonthWidgetProvider.class,
            SubjectsWidgetProvider.class,
            ExamTrendWidgetProvider.class,
            ExamTagsWidgetProvider.class,
            KonkurRoadmapWidgetProvider.class
    };

    private WidgetData() {}

    public static JSONObject get(Context c) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            return new JSONObject(p.getString(KEY_SNAPSHOT, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    public static void save(Context c, String json) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            p.edit().putString(KEY_SNAPSHOT, json).apply();
        } catch (Exception ignored) {}
    }

    public static JSONObject object(JSONObject o, String key) {
        try { return o.getJSONObject(key); } catch (Exception e) { return new JSONObject(); }
    }

    public static JSONArray array(JSONObject o, String key) {
        try { return o.getJSONArray(key); } catch (Exception e) { return new JSONArray(); }
    }

    public static JSONObject object(JSONArray a, int index) {
        try { return a.getJSONObject(index); } catch (Exception e) { return new JSONObject(); }
    }

    public static String str(JSONObject o, String key, String fallback) {
        try {
            String v = o.getString(key);
            return v == null ? fallback : v;
        } catch (Exception e) { return fallback; }
    }

    public static int num(JSONObject o, String key, int fallback) {
        try { return o.getInt(key); } catch (Exception e) { return fallback; }
    }

    public static double dbl(JSONObject o, String key, double fallback) {
        try { return o.getDouble(key); } catch (Exception e) { return fallback; }
    }

    public static String hours(double v) {
        return String.format(java.util.Locale.US, "%.1f", v);
    }

    public static int color(String value, int fallback) {
        try { return Color.parseColor(value); } catch (Exception e) { return fallback; }
    }

    public static void pushAll(Context c) {
        for (Class<?> provider : PROVIDERS) {
            try {
                Intent intent = new Intent(c, provider);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, provider));
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                c.sendBroadcast(intent);
            } catch (Exception ignored) {}
        }
    }
}
