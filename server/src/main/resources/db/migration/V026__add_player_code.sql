-- Add player_code column (nullable first for backfill)
ALTER TABLE players ADD COLUMN player_code VARCHAR(8);

-- Backfill existing players with random codes
DO $$
DECLARE
    charset TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    player_row RECORD;
    new_code TEXT;
    collision BOOLEAN;
BEGIN
    FOR player_row IN SELECT id FROM players WHERE player_code IS NULL LOOP
        collision := TRUE;
        WHILE collision LOOP
            new_code := '';
            FOR i IN 1..8 LOOP
                new_code := new_code || substr(charset, floor(random() * 30 + 1)::int, 1);
            END LOOP;
            collision := EXISTS(SELECT 1 FROM players WHERE player_code = new_code);
        END LOOP;
        UPDATE players SET player_code = new_code WHERE id = player_row.id;
    END LOOP;
END $$;

-- Now make it NOT NULL and add unique index
ALTER TABLE players ALTER COLUMN player_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_player_code ON players (player_code);
