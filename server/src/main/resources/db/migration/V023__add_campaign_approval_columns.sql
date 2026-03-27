ALTER TABLE kuji_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;

ALTER TABLE unlimited_campaigns
    ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN approved_by     UUID,
    ADD COLUMN approved_at     TIMESTAMPTZ;

COMMENT ON COLUMN kuji_campaigns.approval_status IS 'NOT_REQUIRED | PENDING | APPROVED | REJECTED';
COMMENT ON COLUMN unlimited_campaigns.approval_status IS 'NOT_REQUIRED | PENDING | APPROVED | REJECTED';
