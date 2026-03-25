CREATE TABLE server_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(32) NOT NULL, -- 'MAINTENANCE', 'ANNOUNCEMENT', 'UPDATE_REQUIRED'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_blocking BOOLEAN NOT NULL DEFAULT false, -- true = blocks access
    target_platforms TEXT[] DEFAULT '{}', -- ['WEB', 'ANDROID', 'IOS', 'ALL']
    min_app_version VARCHAR(32), -- null = all versions affected
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    created_by_staff_id UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_server_announcements_updated_at
    BEFORE UPDATE ON server_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_announcements_active ON server_announcements (is_active, type);
