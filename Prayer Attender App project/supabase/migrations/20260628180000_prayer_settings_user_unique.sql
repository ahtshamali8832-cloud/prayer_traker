-- Step 1: Remove duplicate prayer_settings rows (keep the newest per user)
DELETE FROM prayer_settings
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM prayer_settings
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Create unique index (one row per user)
CREATE UNIQUE INDEX IF NOT EXISTS prayer_settings_user_id_unique
  ON prayer_settings (user_id)
  WHERE user_id IS NOT NULL;
