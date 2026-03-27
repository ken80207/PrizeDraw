CREATE TABLE system_settings (
    key        VARCHAR(128) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

COMMENT ON TABLE system_settings IS 'Key-value store for configurable system parameters';
COMMENT ON COLUMN system_settings.value IS 'JSON primitive value (number, boolean, string)';

INSERT INTO system_settings (key, value) VALUES
  ('risk.margin_threshold_pct', '20'),
  ('risk.require_approval_below_threshold', 'false');
