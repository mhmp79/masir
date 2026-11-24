package app.masirkonkur.twa;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import org.json.JSONObject;

public class WidgetSyncActivity extends Activity {
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            String encoded = getIntent().getStringExtra("d");
            if (encoded == null) {
                Uri uri = getIntent().getData();
                encoded = uri == null ? null : uri.getQueryParameter("d");
            }
            if (encoded != null && encoded.length() > 0) {
                byte[] raw = Base64.decode(encoded, Base64.URL_SAFE | Base64.NO_WRAP);
                JSONObject snapshot = new JSONObject(new String(raw, "UTF-8"));
                WidgetData.save(this, snapshot.toString());
                WidgetData.pushAll(this);
            }
        } catch (Exception e) {
            Log.w("MasirWidgets", "Could not update widgets", e);
        }
        finish();
    }
}
