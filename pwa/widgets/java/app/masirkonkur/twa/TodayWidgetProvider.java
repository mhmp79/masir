package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class TodayWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_today; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject day = WidgetData.object(d, "day");
        v.setTextViewText(R.id.widget_app, WidgetData.str(d, "app", "مسیر"));
        v.setTextViewText(R.id.widget_day, WidgetData.str(day, "label", "امروز") + " • " + WidgetData.str(day, "date", ""));
        v.setTextViewText(R.id.widget_countdown, WidgetData.num(day, "weeksLeft", 0) + " هفته تا کنکور");
        v.setTextViewText(R.id.widget_days_left, WidgetData.num(day, "daysLeft", 0) + " روز");
        v.setTextViewText(R.id.widget_hours, WidgetData.hours(WidgetData.dbl(day, "hours", 0)) + " ساعت");
        v.setTextViewText(R.id.widget_tests, WidgetData.num(day, "tests", 0) + " تست");
    }
}
