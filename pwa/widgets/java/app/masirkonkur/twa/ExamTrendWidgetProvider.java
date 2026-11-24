package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class ExamTrendWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_exam_trend; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject exams = WidgetData.object(d, "exams");
        JSONArray points = WidgetData.array(exams, "points");
        boolean empty = WidgetData.num(exams, "enabled", 0) != 1 || points.length() == 0;
        v.setTextViewText(R.id.widget_empty, empty ? "هنوز تراز آزمونی ثبت نشده" : "");
        int start = Math.max(0, points.length() - 5);
        for (int i = 0; i < 5; i++) {
            int labelId = c.getResources().getIdentifier("exam" + i, "id", c.getPackageName());
            int valueId = c.getResources().getIdentifier("value" + i, "id", c.getPackageName());
            if (labelId == 0 || valueId == 0) continue;
            int index = start + i;
            if (empty || index >= points.length()) {
                v.setTextViewText(labelId, "");
                v.setTextViewText(valueId, "");
            } else {
                JSONObject point = WidgetData.object(points, index);
                v.setTextViewText(labelId, WidgetData.str(point, "label", "-"));
                v.setTextViewText(valueId, String.valueOf(WidgetData.num(point, "taraz", 0)));
            }
        }
    }
}
