package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class WeekTrendWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_week_trend; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject week = WidgetData.object(d, "week");
        JSONArray days = WidgetData.array(week, "days");
        int max = 60;
        for (int i = 0; i < days.length(); i++) {
            max = Math.max(max, WidgetData.num(WidgetData.object(days, i), "minutes", 0));
        }
        for (int i = 0; i < 7; i++) {
            int labelId = c.getResources().getIdentifier("day" + i, "id", c.getPackageName());
            int barId = c.getResources().getIdentifier("bar" + i, "id", c.getPackageName());
            int valueId = c.getResources().getIdentifier("value" + i, "id", c.getPackageName());
            if (labelId == 0 || barId == 0 || valueId == 0) continue;
            if (i >= days.length()) {
                v.setTextViewText(labelId, "-");
                v.setTextViewText(valueId, "");
                v.setProgressBar(barId, 100, 0, false);
                continue;
            }
            JSONObject day = WidgetData.object(days, i);
            int minutes = WidgetData.num(day, "minutes", 0);
            v.setTextViewText(labelId, WidgetData.str(day, "label", "-"));
            v.setTextViewText(valueId, WidgetData.hours(minutes / 60.0));
            v.setProgressBar(barId, 100, Math.min(100, minutes * 100 / max), false);
        }
    }
}
