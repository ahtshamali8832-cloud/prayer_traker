/*
# Add user authentication to prayer tables

- Add user_id column to prayer_attendance and prayer_settings
- Scope RLS policies to authenticated users' own data
*/

ALTER TABLE prayer_attendance
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE prayer_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE prayer_attendance
  DROP CONSTRAINT IF EXISTS prayer_attendance_prayer_name_prayer_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS prayer_attendance_user_prayer_date_unique
  ON prayer_attendance (user_id, prayer_name, prayer_date);

DROP POLICY IF EXISTS "anon_select_prayer_attendance" ON prayer_attendance;
DROP POLICY IF EXISTS "anon_insert_prayer_attendance" ON prayer_attendance;
DROP POLICY IF EXISTS "anon_update_prayer_attendance" ON prayer_attendance;
DROP POLICY IF EXISTS "anon_delete_prayer_attendance" ON prayer_attendance;

DROP POLICY IF EXISTS "anon_select_prayer_settings" ON prayer_settings;
DROP POLICY IF EXISTS "anon_insert_prayer_settings" ON prayer_settings;
DROP POLICY IF EXISTS "anon_update_prayer_settings" ON prayer_settings;
DROP POLICY IF EXISTS "anon_delete_prayer_settings" ON prayer_settings;

CREATE POLICY "users_select_own_attendance" ON prayer_attendance FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_attendance" ON prayer_attendance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_attendance" ON prayer_attendance FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_attendance" ON prayer_attendance FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_select_own_settings" ON prayer_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_settings" ON prayer_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_settings" ON prayer_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_settings" ON prayer_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
