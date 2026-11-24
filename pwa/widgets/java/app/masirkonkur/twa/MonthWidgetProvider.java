package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class MonthWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_month; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject month = WidgetData.object(d, "month");
        int[] colors = new int[]{0xFF202944, 0xFF1E3A5F, 0xFF245E83, 0xFF2E8FB0, 0xFF22D3EE};
        JSONArray days = WidgetData.array(month, "days");
        int offset = WidgetData.num(month, "startCol", 0);
        v.setTextViewText(R.id.widget_title, WidgetData.str(month, "title", "هیت\u200cمپ ماهانه"));
        v.setTextViewText(R.id.widget_total, WidgetData.hours(WidgetData.dbl(month, "totalHours", 0)) + " ساعت");
        v.setTextViewText(R.id.widget_active, WidgetData.num(month, "activeDays", 0) + " روز فعال");
        for (int i = 0; i < 35; i++) {
            int id = c.getResources().getIdentifier("cell" + i, "id", c.getPackageName());
            if (id == 0) continue;
            int index = i - offset;
            if (index >= 0 && index < days.length()) {
                int level = WidgetData.num(WidgetData.object(days, index), "level", 0);
                v.setTextViewText(id, "");
                v.setInt(id, "setBackgroundColor", colors[Math.max(0, Math.min(4, level))]);
            } else {
                v.setTextViewText(id, "");
                v.setInt(id, "setBackgroundColor", 0x00000000);
            }
        }
    }
}
