CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_follows_follower_following UNIQUE (follower_id, following_id),
    CONSTRAINT chk_follows_no_self CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows (follower_id, created_at DESC);
CREATE INDEX idx_follows_following ON follows (following_id, created_at DESC);
