package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class ExamTagsWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_exam_tags; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject exams = WidgetData.object(d, "exams");
        JSONArray tags = WidgetData.array(exams, "tags");
        v.setTextViewText(R.id.widget_empty, tags.length() == 0 ? "هنوز تگ اشتباهی ثبت نشده" : "");
        for (int i = 0; i < 3; i++) {
            int labelId = c.getResources().getIdentifier("tag" + i, "id", c.getPackageName());
            int countId = c.getResources().getIdentifier("count" + i, "id", c.getPackageName());
            if (labelId == 0 || countId == 0) continue;
            if (i >= tags.length()) {
                v.setTextViewText(labelId, "");
                v.setTextViewText(countId, "");
            } else {
                JSONObject tag = WidgetData.object(tags, i);
                v.setTextViewText(labelId, WidgetData.str(tag, "label", "-"));
                v.setTextViewText(countId, WidgetData.num(tag, "count", 0) + " مورد");
            }
        }
    }
}
