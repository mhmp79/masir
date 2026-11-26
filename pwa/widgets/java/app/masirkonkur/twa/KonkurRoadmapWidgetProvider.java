package app.masirkonkur.twa;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class KonkurRoadmapWidgetProvider extends MasirWidgetProvider {
    @Override protected int layoutId() { return R.layout.widget_konkur_roadmap; }

    @Override protected void bind(Context c, RemoteViews v, JSONObject d, int[] ids) {
        JSONObject roadmap = WidgetData.object(d, "roadmap");
        JSONArray exams = WidgetData.array(roadmap, "exams");
        int daysLeft = WidgetData.num(roadmap, "daysLeft", 0);
        v.setTextViewText(R.id.widget_app, WidgetData.str(d, "app", "مسیر"));
        v.setTextViewText(R.id.widget_roadmap_days, daysLeft + " روز تا کنکور");
        v.setTextViewText(R.id.widget_roadmap_line, "●━━━━━━●━━━━━━●");
        if (exams.length() > 0) {
            JSONObject first = WidgetData.object(exams, 0);
            v.setTextViewText(R.id.widget_roadmap_exam,
                    "نزدیکترین آزمون: " + WidgetData.str(first, "label", "آزمون")
                            + " • " + WidgetData.num(first, "days", 0) + " روز");
        } else {
            v.setTextViewText(R.id.widget_roadmap_exam, "آزمون پیشرویی ثبت نشده است");
        }
        v.setTextViewText(R.id.widget_roadmap_count, exams.length() + " آزمون پیشرو");
    }
}
