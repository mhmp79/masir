package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class SubjectsWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_subjects; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject subjects = WidgetData.object(d, "subjects");
        JSONArray rows = WidgetData.array(subjects, "rows");
        String mode = "study".equals(WidgetData.str(subjects, "mode", "study")) ? "ساعت" : "تست";
        v.setTextViewText(R.id.widget_title, "سهم دروس در هفته");
        for (int i = 0; i < 4; i++) {
            int nameId = c.getResources().getIdentifier("subject" + i, "id", c.getPackageName());
            int pctId = c.getResources().getIdentifier("pct" + i, "id", c.getPackageName());
            int dotId = c.getResources().getIdentifier("dot" + i, "id", c.getPackageName());
            if (nameId == 0 || pctId == 0 || dotId == 0) continue;
            if (i >= rows.length()) {
                v.setTextViewText(nameId, "-");
                v.setTextViewText(pctId, "");
                v.setInt(dotId, "setBackgroundColor", 0x00000000);
                continue;
            }
            JSONObject row = WidgetData.object(rows, i);
            v.setTextViewText(nameId, WidgetData.str(row, "name", "-"));
            v.setTextViewText(pctId, WidgetData.num(row, "pct", 0) + "٪ " + mode);
            v.setInt(dotId, "setBackgroundColor", WidgetData.color(WidgetData.str(row, "color", "#7C5CFF"), 0xFF7C5CFF));
        }
    }
}
