-- V030__create_grade_system.sql
-- Prize Grade System: templates, campaign grades, and prize definition FK

-- 1. Grade templates (reusable grade presets)
CREATE TABLE grade_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Grade template items (individual tiers within a template)
CREATE TABLE grade_template_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES grade_templates(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    display_order   INT NOT NULL,
    color_code      VARCHAR(9) NOT NULL,
    bg_color_code   VARCHAR(9) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (template_id, display_order)
);

-- 3. Campaign grades (per-campaign grade definitions, copied from template)
CREATE TABLE campaign_grades (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kuji_campaign_id        UUID REFERENCES kuji_campaigns(id) ON DELETE CASCADE,
    unlimited_campaign_id   UUID REFERENCES unlimited_campaigns(id) ON DELETE CASCADE,
    name                    VARCHAR(50) NOT NULL,
    display_order           INT NOT NULL,
    color_code              VARCHAR(9) NOT NULL,
    bg_color_code           VARCHAR(9) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT campaign_grades_campaign_xor
        CHECK ((kuji_campaign_id IS NOT NULL) != (unlimited_campaign_id IS NOT NULL))
);

-- Partial unique indexes (NULL-safe display_order uniqueness per campaign)
CREATE UNIQUE INDEX uq_campaign_grades_kuji_order
    ON campaign_grades (kuji_campaign_id, display_order)
    WHERE kuji_campaign_id IS NOT NULL;

CREATE UNIQUE INDEX uq_campaign_grades_unlimited_order
    ON campaign_grades (unlimited_campaign_id, display_order)
    WHERE unlimited_campaign_id IS NOT NULL;

-- 4. Add campaign_grade_id FK to prize_definitions
ALTER TABLE prize_definitions
    ADD COLUMN campaign_grade_id UUID REFERENCES campaign_grades(id);

CREATE INDEX idx_prize_definitions_campaign_grade_id
    ON prize_definitions(campaign_grade_id);
