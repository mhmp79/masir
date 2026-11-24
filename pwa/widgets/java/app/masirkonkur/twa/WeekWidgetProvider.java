package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class WeekWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_week; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject week = WidgetData.object(d, "week");
        int pct = WidgetData.num(week, "pct", 0);
        v.setTextViewText(R.id.widget_pct, pct + "٪");
        v.setProgressBar(R.id.widget_progress, 100, pct, false);
        v.setTextViewText(R.id.widget_total, WidgetData.hours(WidgetData.dbl(week, "totalHours", 0)) + " ساعت مطالعه");
        v.setTextViewText(R.id.widget_goal, "هدف هفتگی: " + WidgetData.num(week, "goalHours", 40) + " ساعت");
        v.setTextViewText(R.id.widget_tests, WidgetData.num(week, "tests", 0) + " تست این هفته");
    }
}
