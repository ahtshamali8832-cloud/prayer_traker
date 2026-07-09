/*
# Create Prayer Attendance Tables

1. New Tables
- `prayer_attendance`
  - `id` (uuid, primary key) - unique identifier
  - `prayer_name` (text, not null) - name of prayer: fajr, dhuhr, asr, maghrib, isha
  - `attended` (boolean, default false) - whether user attended this prayer
  - `prayer_date` (date, not null) - date of the prayer
  - `created_at` (timestamptz) - when record was created
  - `updated_at` (timestamptz) - when record was last updated
  - `latitude` (double precision) - location latitude for prayer calculation
  - `longitude` (double precision) - location longitude for prayer calculation
  - `timezone` (text) - timezone for the location
  - `calculation_method` (text, default 'Karachi') - method used for prayer time calculation
  - `city` (text) - user-set city name
  - `country` (text) - user-set country name

- `prayer_settings`
  - `id` (uuid, primary key) - unique identifier
  - `latitude` (double precision, default 24.8607) - default location (Karachi)
  - `longitude` (double precision, default 67.0011) - default location (Karachi)
  - `timezone` (text, default 'Asia/Karachi') - default timezone
  - `calculation_method` (text, default 'Karachi') - calculation method
  - `city` (text, default 'Karachi') - city name
  - `country` (text, default 'Pakistan') - country name
  - `sound_enabled` (boolean, default true) - whether Allah o Akbar sound plays
  - `created_at` (timestamptz) - when record was created
  - `updated_at` (timestamptz) - when record was last updated

2. Security
- Enable RLS on both tables.
- Allow anon and authenticated users full CRUD since this is a single-tenant app with no sign-in.
*/

CREATE TABLE IF NOT EXISTS prayer_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL CHECK (prayer_name IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  attended boolean NOT NULL DEFAULT false,
  prayer_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  latitude double precision DEFAULT 24.8607,
  longitude double precision DEFAULT 67.0011,
  timezone text DEFAULT 'Asia/Karachi',
  calculation_method text DEFAULT 'Karachi',
  city text DEFAULT 'Karachi',
  country text DEFAULT 'Pakistan',
  UNIQUE(prayer_name, prayer_date)
);

CREATE TABLE IF NOT EXISTS prayer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL DEFAULT 24.8607,
  longitude double precision NOT NULL DEFAULT 67.0011,
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  calculation_method text NOT NULL DEFAULT 'Karachi',
  city text NOT NULL DEFAULT 'Karachi',
  country text NOT NULL DEFAULT 'Pakistan',
  sound_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prayer_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_prayer_attendance" ON prayer_attendance;
CREATE POLICY "anon_select_prayer_attendance" ON prayer_attendance FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_prayer_attendance" ON prayer_attendance;
CREATE POLICY "anon_insert_prayer_attendance" ON prayer_attendance FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_prayer_attendance" ON prayer_attendance;
CREATE POLICY "anon_update_prayer_attendance" ON prayer_attendance FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_prayer_attendance" ON prayer_attendance;
CREATE POLICY "anon_delete_prayer_attendance" ON prayer_attendance FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_prayer_settings" ON prayer_settings;
CREATE POLICY "anon_select_prayer_settings" ON prayer_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_prayer_settings" ON prayer_settings;
CREATE POLICY "anon_insert_prayer_settings" ON prayer_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_prayer_settings" ON prayer_settings;
CREATE POLICY "anon_update_prayer_settings" ON prayer_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_prayer_settings" ON prayer_settings;
CREATE POLICY "anon_delete_prayer_settings" ON prayer_settings FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO prayer_settings (id, latitude, longitude, timezone, calculation_method, city, country, sound_enabled)
SELECT gen_random_uuid(), 24.8607, 67.0011, 'Asia/Karachi', 'Karachi', 'Karachi', 'Pakistan', true
WHERE NOT EXISTS (SELECT 1 FROM prayer_settings LIMIT 1);
