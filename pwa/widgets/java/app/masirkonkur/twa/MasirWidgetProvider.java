package app.masirkonkur.twa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import org.json.JSONObject;

public abstract class MasirWidgetProvider extends AppWidgetProvider {
    protected abstract int layoutId();
    protected abstract void bind(Context c, RemoteViews views, JSONObject data, int[] ids);

    @Override
    public void onUpdate(Context c, AppWidgetManager manager, int[] ids) {
        JSONObject data = WidgetData.get(c);
        RemoteViews views = new RemoteViews(c.getPackageName(), layoutId());
        bind(c, views, data, ids);

        Intent open = new Intent(c, LauncherActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(c, 71, open, flags));
        manager.updateAppWidget(ids, views);
    }
}
