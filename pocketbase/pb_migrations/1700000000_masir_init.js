/// Masir PocketBase migration
/// Creates collections used by pb_hooks/main.pb.js.
/// Compatible with PocketBase JS migrations where migrate((app)=>{}, (app)=>{}).

migrate((app) => {
  const dao = typeof app.findCollectionByNameOrId === "function" ? app : app.dao();

  function ensureCollection(name, type, fields, indexes) {
    let col = null;
    try { col = dao.findCollectionByNameOrId(name); } catch (_) {}
    if (!col) {
      col = new Collection({ name, type: type || "base" });
    }
    const schema = col.schema;
    function hasField(n) { try { return !!schema.getFieldByName(n); } catch (_) { return false; } }
    for (const f of fields || []) {
      if (hasField(f.name)) continue;
      // PocketBase v0.22 schema field constructor
      const field = new SchemaField(f);
      schema.addField(field);
    }
    if (indexes && indexes.length) col.indexes = indexes;
    // API rules: locked down; only hooks/server-side dao should access.
    col.listRule = null;
    col.viewRule = null;
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    dao.saveCollection(col);
    return col;
  }

  ensureCollection("masir_users", "base", [
    { name: "phone", type: "text", required: true },
    { name: "role", type: "text", required: true },
    { name: "display_name", type: "text" },
    { name: "first_name", type: "text" },
    { name: "last_name", type: "text" },
    { name: "field", type: "text" },
    { name: "grade", type: "text" },
    { name: "password_hash", type: "text" },
    { name: "password_updated_at", type: "date" },
  ], [
    "CREATE UNIQUE INDEX idx_masir_users_phone ON masir_users (phone)",
  ]);

  ensureCollection("masir_otp_codes", "base", [
    { name: "phone", type: "text", required: true },
    { name: "purpose", type: "text", required: true },
    { name: "code_hash", type: "text", required: true },
    { name: "expires_at", type: "date", required: true },
    { name: "consumed_at", type: "date" },
    { name: "attempts", type: "number" },
  ], [
    "CREATE INDEX idx_masir_otp_phone_purpose ON masir_otp_codes (phone, purpose)",
  ]);

  ensureCollection("masir_advisor_links", "base", [
    { name: "advisor_id", type: "text", required: true },
    { name: "student_id", type: "text" },
    { name: "status", type: "text", required: true },
    { name: "code", type: "text" },
    { name: "permissions", type: "json" },
    { name: "approved_at", type: "date" },
  ], [
    "CREATE INDEX idx_masir_links_advisor ON masir_advisor_links (advisor_id)",
    "CREATE INDEX idx_masir_links_student ON masir_advisor_links (student_id)",
    "CREATE INDEX idx_masir_links_code ON masir_advisor_links (code)",
  ]);

  ensureCollection("masir_changes", "base", [
    { name: "owner_id", type: "text", required: true },
    { name: "table_name", type: "text", required: true },
    { name: "row_id", type: "text", required: true },
    { name: "op", type: "text", required: true },
    { name: "updated", type: "date", required: true },
    { name: "data", type: "json" },
    { name: "actor_id", type: "text" },
  ], [
    "CREATE INDEX idx_masir_changes_owner_updated ON masir_changes (owner_id, updated)",
  ]);

  const synced = {
    masir_subjects: [
      { name: "owner_id", type: "text", required: true },
      { name: "local_id", type: "text", required: true },
      { name: "name", type: "text" }, { name: "color", type: "text" }, { name: "type", type: "text" }, { name: "field", type: "text" },
      { name: "config", type: "json" }, { name: "sessions_count", type: "number" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_sessions: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "subject", type: "text" }, { name: "topic", type: "text" }, { name: "dur_min", type: "number" }, { name: "date", type: "text" },
      { name: "start_min", type: "number" }, { name: "done", type: "bool" }, { name: "done_at", type: "number" },
      { name: "activity_id", type: "text" }, { name: "exam_id", type: "text" }, { name: "ts", type: "number" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_activities: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "subject", type: "text" }, { name: "topic", type: "text" }, { name: "minutes", type: "number" }, { name: "date", type: "text" },
      { name: "start_min", type: "number" }, { name: "end_min", type: "number" }, { name: "note", type: "text" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_classes: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "subject", type: "text" }, { name: "total", type: "number" }, { name: "sessions", type: "json" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_sleeps: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "date", type: "text" }, { name: "end_date", type: "text" }, { name: "start_min", type: "number" }, { name: "end_min", type: "number" },
      { name: "nap", type: "bool" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_phones: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "date", type: "text" }, { name: "start_min", type: "number" }, { name: "end_min", type: "number" }, { name: "subject", type: "text" },
      { name: "note", type: "text" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_exams: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "name", type: "text" }, { name: "date", type: "text" }, { name: "has_results", type: "bool" }, { name: "total_taraz", type: "number" },
      { name: "subjects", type: "json" }, { name: "questions_count", type: "number" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_questions: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "exam_id", type: "text" }, { name: "number", type: "number" }, { name: "subject", type: "text" }, { name: "topic", type: "text" },
      { name: "status", type: "text" }, { name: "note", type: "text" }, { name: "question_text", type: "text" }, { name: "answer_text", type: "text" },
      { name: "options", type: "json" }, { name: "tags", type: "json" }, { name: "starred", type: "bool" }, { name: "figure_ref", type: "text" },
      { name: "note_hidden", type: "bool" }, { name: "ts", type: "number" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_app_meta: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "value", type: "json" }, { name: "local_order", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_tracker: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "correct", type: "number" }, { name: "wrong", type: "number" }, { name: "blank", type: "number" }, { name: "coef", type: "number" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
    masir_timer: [
      { name: "owner_id", type: "text", required: true }, { name: "local_id", type: "text", required: true },
      { name: "running", type: "bool" }, { name: "started_at", type: "number" }, { name: "elapsed_ms", type: "number" }, { name: "mode", type: "text" },
      { name: "updated", type: "date", required: true }, { name: "deleted", type: "bool" }, { name: "data", type: "json" },
    ],
  };

  for (const [name, fields] of Object.entries(synced)) {
    ensureCollection(name, "base", fields, [
      `CREATE INDEX idx_${name}_owner_local ON ${name} (owner_id, local_id)`,
      `CREATE INDEX idx_${name}_owner_updated ON ${name} (owner_id, updated)`,
    ]);
  }
}, (app) => {
  // No destructive down migration.
});
