import { Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: string;
  calculationMethod: string;
}

type LocationListener = () => void;
const locationListeners = new Set<LocationListener>();

let syncInProgress: Promise<SyncLocationResult> | null = null;
let lastSyncedUserId: string | null = null;
let lastSyncedAt = 0;
let jaranwalaResyncAttempted = false;
/** Min gap between GPS travel checks (same session / tab switches). */
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
/** Re-sync city when user moves at least this far from saved coordinates. */
const SIGNIFICANT_MOVE_KM = 20;

export function onLocationUpdated(listener: LocationListener) {
  locationListeners.add(listener);
  return () => {
    locationListeners.delete(listener);
  };
}

function emitLocationUpdated() {
  locationListeners.forEach((listener) => listener());
}

function isInFaisalabadRegion(lat: number, lon: number): boolean {
  return lat >= 30.95 && lat <= 31.85 && lon >= 72.55 && lon <= 73.65;
}

function normalizePakistanCity(name: string, lat: number, lon: number): string {
  const lower = name.toLowerCase();

  if (isInFaisalabadRegion(lat, lon)) {
    if (lower.includes('lahore') || lower.includes('punjab')) return 'Faisalabad';
    if (lower.includes('faisalabad') || lower.includes('lyallpur')) return 'Faisalabad';
  }

  if (lower.includes('faisalabad') || lower.includes('lyallpur')) return 'Faisalabad';
  if (lower.includes('lahore')) return 'Lahore';
  if (lower.includes('karachi')) return 'Karachi';
  if (lower.includes('islamabad')) return 'Islamabad';
  if (lower.includes('rawalpindi')) return 'Rawalpindi';
  if (lower.includes('multan')) return 'Multan';

  return name;
}

function buildDisplayCity(locality: string | undefined, city: string, lat: number, lon: number): string {
  const resolvedCity = normalizePakistanCity(city, lat, lon);
  const resolvedLocality = locality ? normalizePakistanCity(locality, lat, lon) : '';

  if (
    resolvedLocality &&
    resolvedLocality !== resolvedCity &&
    !resolvedCity.toLowerCase().includes(resolvedLocality.toLowerCase())
  ) {
    return `${resolvedLocality}, ${resolvedCity}`;
  }

  return resolvedCity || resolvedLocality || 'Unknown City';
}

function cityFromCoordinates(lat: number, lon: number): { city: string; country: string } {
  if (isInKhurranwalaChakArea(lat, lon)) {
    return { city: 'Khurranwala', country: 'Pakistan' };
  }
  if (isInFaisalabadRegion(lat, lon)) {
    return { city: 'Faisalabad', country: 'Pakistan' };
  }
  return { city: 'Unknown City', country: 'Pakistan' };
}

export function getTimezoneOffsetHours(timezone?: string, date = new Date()): number {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
      }).formatToParts(date);
      const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        return sign * (hours + minutes / 60);
      }
    } catch {
      // fall through
    }
  }

  return -date.getTimezoneOffset() / 60;
}

function defaultCalculationMethod(country: string): string {
  const c = country.toLowerCase();
  if (c.includes('pakistan')) return 'Karachi';
  if (c.includes('saudi') || c.includes('arabia')) return 'Makkah';
  if (c.includes('united arab emirates') || c === 'uae') return 'Dubai';
  if (c.includes('qatar')) return 'Qatar';
  if (c.includes('kuwait')) return 'Kuwait';
  if (c.includes('egypt')) return 'Egypt';
  if (c.includes('turkey') || c.includes('türkiye')) return 'Turkey';
  if (c.includes('iran')) return 'Tehran';
  if (c.includes('singapore')) return 'Singapore';
  return 'MuslimWorldLeague';
}

function resolveTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
}

async function detectLocationFromIpApi(): Promise<UserLocation> {
  const response = await fetch('https://ipapi.co/json/');
  if (!response.ok) throw new Error('IP location unavailable');

  const data = await response.json();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const rawCity = data.city || 'Unknown City';
  const country = data.country_name || 'Unknown';

  return {
    latitude,
    longitude,
    city: fixMisidentifiedCity(rawCity, latitude, longitude),
    country,
    timezone: data.timezone || resolveTimezone(),
    calculationMethod: defaultCalculationMethod(country),
  };
}

/** @deprecated use detectLocationFromIpApi */
async function detectLocationFromIp() {
  const loc = await detectLocationFromIpApi();
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    city: loc.city,
    country: loc.country,
  };
}

function isInKhurranwalaChakArea(lat: number, lon: number): boolean {
  // Chak 77 RB / Lohka Kalaan / Khurranwala vicinity (per user GPS ~31.478, 73.307)
  return lat >= 31.44 && lat <= 31.52 && lon >= 73.24 && lon <= 73.38;
}

function fixMisidentifiedCity(
  city: string,
  lat: number,
  lon: number,
  locality?: string
): string {
  if (isInKhurranwalaChakArea(lat, lon)) {
    const wrongNames = ['jaranwala', 'jarannwala', 'lahore'];
    if (locality) {
      const loc = locality.trim();
      if (loc.toLowerCase().includes('chak') || loc.toLowerCase().includes('lohka')) {
        return loc;
      }
      return buildDisplayCity(loc, 'Khurranwala', lat, lon);
    }
    if (wrongNames.some((w) => city.toLowerCase().includes(w))) {
      return 'Khurranwala';
    }
  }
  return normalizePakistanCity(city, lat, lon);
}

async function reverseGeocodeNominatim(latitude: number, longitude: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=16&accept-language=en`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PrayerAttenderApp/1.0',
      },
    }
  );
  if (!response.ok) throw new Error('Nominatim failed');

  const data = await response.json();
  const address = data.address ?? {};

  const locality =
    address.residential ||
    address.village ||
    address.hamlet ||
    address.neighbourhood ||
    address.suburb ||
    address.locality ||
    address.town;

  const district =
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    address.state_district ||
    address.district ||
    'Faisalabad';

  const country = address.country || 'Pakistan';
  const city = fixMisidentifiedCity(district, latitude, longitude, locality);

  return { city, country };
}

async function reverseGeocodeBigDataCloud(latitude: number, longitude: number) {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  );
  if (!response.ok) throw new Error('Reverse geocode failed');

  const data = await response.json();
  const locality = data.locality || data.localityInfo?.administrative?.[3]?.name;
  const city =
    data.city ||
    data.locality ||
    data.principalSubdivision ||
    data.localityInfo?.administrative?.[2]?.name ||
    'Unknown City';
  const country = data.countryName || 'Pakistan';

  return {
    city: fixMisidentifiedCity(city, latitude, longitude, locality),
    country,
  };
}

async function reverseGeocode(latitude: number, longitude: number) {
  const fallback = cityFromCoordinates(latitude, longitude);

  try {
    return await Promise.race([
      reverseGeocodeNominatim(latitude, longitude),
      new Promise<{ city: string; country: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Geocode timeout')), 5000)
      ),
    ]);
  } catch {
    try {
      const geocode = await reverseGeocodeBigDataCloud(latitude, longitude);
      return {
        city: fixMisidentifiedCity(geocode.city, latitude, longitude),
        country: geocode.country,
      };
    } catch {
      if (Platform.OS !== 'web') {
        try {
          const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
          const place = results[0];
          if (place) {
            const locality = place.district || place.subregion;
            const city = place.city || place.region || fallback.city;
            return {
              city: fixMisidentifiedCity(city, latitude, longitude, locality ?? undefined),
              country: place.country || fallback.country,
            };
          }
        } catch {
          // use coordinate fallback
        }
      }
      if (isInKhurranwalaChakArea(latitude, longitude)) {
        return { city: 'Khurranwala', country: 'Pakistan' };
      }
      return fallback;
    }
  }
}

function getWebPosition(options: PositionOptions): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => reject(error),
      options
    );
  });
}

/** GPS only — never falls back to IP (avoids wrong city like Jaranwala). */
async function requestGpsOnlyWeb(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  ];

  for (const options of attempts) {
    try {
      return await getWebPosition(options);
    } catch {
      // try next
    }
  }
  return null;
}

async function requestGpsOnlyNative(): Promise<{ latitude: number; longitude: number } | null> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  try {
    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

async function requestGpsOnly(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web') return requestGpsOnlyWeb();
  return requestGpsOnlyNative();
}

async function requestCurrentCoordinatesWeb(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const ip = await detectLocationFromIp();
    return { latitude: ip.latitude, longitude: ip.longitude };
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ];

  for (const options of attempts) {
    try {
      return await getWebPosition(options);
    } catch {
      // try next strategy
    }
  }

  const ip = await detectLocationFromIp();
  return { latitude: ip.latitude, longitude: ip.longitude };
}

async function requestCurrentCoordinatesNative(): Promise<{ latitude: number; longitude: number }> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    const ip = await detectLocationFromIp();
    return { latitude: ip.latitude, longitude: ip.longitude };
  }

  try {
    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    const ip = await detectLocationFromIp();
    return { latitude: ip.latitude, longitude: ip.longitude };
  }
}

export async function requestCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  if (Platform.OS === 'web') {
    return requestCurrentCoordinatesWeb();
  }
  return requestCurrentCoordinatesNative();
}

function fallbackByDeviceTimezone(): UserLocation {
  const timezone = resolveTimezone();
  const isPakistan = timezone.includes('Karachi') || timezone.includes('Islamabad');

  if (isPakistan) {
    return {
      latitude: 31.418,
      longitude: 73.0776,
      city: 'Faisalabad',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
      calculationMethod: 'Karachi',
    };
  }

  return {
    latitude: 24.8607,
    longitude: 67.0011,
    city: 'Karachi',
    country: 'Pakistan',
    timezone,
    calculationMethod: 'MuslimWorldLeague',
  };
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Login/signup: permission prompt + GPS (accurate) or IP fallback, then save. */
export async function syncLocationOnLogin(userId: string): Promise<SyncLocationResult> {
  await requestLocationPermission();

  const gps = await requestGpsOnly();

  let location: UserLocation;

  if (gps) {
    const geocode = await reverseGeocode(gps.latitude, gps.longitude).catch(() =>
      cityFromCoordinates(gps.latitude, gps.longitude)
    );
    location = {
      latitude: gps.latitude,
      longitude: gps.longitude,
      city: geocode.city,
      country: geocode.country,
      timezone: resolveTimezone(),
      calculationMethod: defaultCalculationMethod(geocode.country),
    };
  } else {
    try {
      location = await detectLocationFromIpApi();
      location.city = fixMisidentifiedCity(location.city, location.latitude, location.longitude);
    } catch {
      location = fallbackByDeviceTimezone();
    }
  }

  await saveUserLocationSettings(userId, location);
  lastSyncedUserId = userId;
  lastSyncedAt = Date.now();
  return { ok: true, location };
}

export async function detectUserLocation(): Promise<UserLocation> {
  const gps = await requestGpsOnly();

  if (gps) {
    const geocode = await reverseGeocode(gps.latitude, gps.longitude).catch(() =>
      cityFromCoordinates(gps.latitude, gps.longitude)
    );
    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
      city: geocode.city,
      country: geocode.country,
      timezone: resolveTimezone(),
      calculationMethod: defaultCalculationMethod(geocode.country),
    };
  }

  try {
    const ip = await detectLocationFromIpApi();
    return {
      ...ip,
      city: fixMisidentifiedCity(ip.city, ip.latitude, ip.longitude),
    };
  } catch {
    return fallbackByDeviceTimezone();
  }
}

function settingsCacheKey(userId: string) {
  return `prayer_settings_cache_${userId}`;
}

type StoredSettings = {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: string;
  calculation_method: string;
  sound_enabled: boolean;
};

async function readLocalSettings(userId: string): Promise<StoredSettings | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = localStorage.getItem(settingsCacheKey(userId));
    } else {
      raw = await AsyncStorage.getItem(settingsCacheKey(userId));
    }
    return raw ? (JSON.parse(raw) as StoredSettings) : null;
  } catch {
    return null;
  }
}

async function writeLocalSettings(userId: string, location: UserLocation, soundEnabled = true) {
  const stored: StoredSettings = {
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city,
    country: location.country,
    timezone: location.timezone,
    calculation_method: location.calculationMethod,
    sound_enabled: soundEnabled,
  };
  const json = JSON.stringify(stored);
  if (Platform.OS === 'web') {
    localStorage.setItem(settingsCacheKey(userId), json);
  } else {
    await AsyncStorage.setItem(settingsCacheKey(userId), json);
  }
}

function storedToDbRow(userId: string, stored: StoredSettings) {
  return {
    id: 'local-cache',
    user_id: userId,
    latitude: stored.latitude,
    longitude: stored.longitude,
    city: stored.city,
    country: stored.country,
    timezone: stored.timezone,
    calculation_method: stored.calculation_method,
    sound_enabled: stored.sound_enabled,
  };
}

export async function saveUserLocationSettings(
  userId: string,
  location: UserLocation
): Promise<void> {
  await writeLocalSettings(userId, location);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.id !== userId) {
    emitLocationUpdated();
    return;
  }

  const payload = {
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city,
    country: location.country,
    timezone: location.timezone,
    calculation_method: location.calculationMethod,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('prayer_settings')
    .update(payload)
    .eq('user_id', userId)
    .select('id');

  if (updateError) {
    console.warn('[location] Supabase update failed:', updateError.message);
    emitLocationUpdated();
    return;
  }

  if (!updatedRows?.length) {
    const { error: insertError } = await supabase.from('prayer_settings').insert({
      ...payload,
      user_id: userId,
      sound_enabled: true,
    });

    if (insertError) {
      console.warn('[location] Supabase insert failed:', insertError.message);
    }
  }

  emitLocationUpdated();
}

export interface SyncLocationResult {
  ok: boolean;
  location?: UserLocation;
  error?: string;
}

export interface PrayerSettingsLike {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  calculation_method?: string;
  city?: string;
  country?: string;
}

export function getPrayerCalcFromSettings(settings: PrayerSettingsLike | null) {
  const hasCoords = settings?.latitude != null && settings?.longitude != null;

  return {
    latitude: settings?.latitude ?? 31.4180,
    longitude: settings?.longitude ?? 73.0776,
    method: settings?.calculation_method ?? 'Karachi',
    timezoneOffsetHours: getTimezoneOffsetHours(settings?.timezone),
    city: settings?.city || (hasCoords ? 'Faisalabad' : '...'),
    country: settings?.country ?? 'Pakistan',
  };
}

export async function fetchUserPrayerSettings(userId: string) {
  try {
    const { data, error } = await supabase
      .from('prayer_settings')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && data?.[0]) return data[0];
    if (error) console.warn('[location] Supabase fetch failed:', error.message);
  } catch (err) {
    console.warn('[location] Supabase fetch error:', err);
  }

  const local = await readLocalSettings(userId);
  if (local) return storedToDbRow(userId, local);

  return null;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shouldSyncLocation(settings: PrayerSettingsLike | null): boolean {
  if (!settings?.city || settings.latitude == null) return true;

  const lat = settings.latitude;
  const lon = settings.longitude ?? 0;
  const cityLower = settings.city.toLowerCase();

  if (lat != null && lon != null && isInFaisalabadRegion(lat, lon) && cityLower.includes('lahore')) {
    return true;
  }

  if (lat != null && lon != null && isInKhurranwalaChakArea(lat, lon) && cityLower.includes('jaranwala')) {
    return true;
  }

  if (lat != null && lon != null && isInKhurranwalaChakArea(lat, lon) && !cityLower.includes('khurranwala') && !cityLower.includes('lohka')) {
    return true;
  }

  return false;
}

function shouldSyncForTravel(
  settings: PrayerSettingsLike | null,
  gps: { latitude: number; longitude: number } | null
): boolean {
  if (!gps) return false;
  if (!settings?.city || settings.latitude == null || settings.longitude == null) return true;
  if (shouldSyncLocation(settings)) return true;

  return distanceKm(settings.latitude, settings.longitude, gps.latitude, gps.longitude) >= SIGNIFICANT_MOVE_KM;
}

export async function syncUserLocation(userId: string): Promise<SyncLocationResult> {
  if (syncInProgress) return syncInProgress;

  syncInProgress = (async () => {
    try {
      const location = await detectUserLocation();
      await saveUserLocationSettings(userId, location);
      lastSyncedUserId = userId;
      lastSyncedAt = Date.now();
      return { ok: true, location };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not detect your location.';
      return { ok: false, error: message };
    } finally {
      syncInProgress = null;
    }
  })();

  return syncInProgress;
}

/** Fast DB read only — does not wait for GPS. */
export async function loadUserPrayerSettings(userId: string) {
  return fetchUserPrayerSettings(userId);
}

/** Sync in background on app open / foreground when user has traveled. Never blocks UI. */
export function maybeSyncLocationInBackground(userId: string, force = false) {
  if (syncInProgress) return;

  const recentlyChecked =
    lastSyncedUserId === userId && Date.now() - lastSyncedAt < SYNC_COOLDOWN_MS;

  if (!force && recentlyChecked) return;

  void (async () => {
    const settings = await fetchUserPrayerSettings(userId);

    const needsJaranwalaFix =
      !jaranwalaResyncAttempted && settings?.city?.toLowerCase().includes('jaranwala');
    if (needsJaranwalaFix) {
      jaranwalaResyncAttempted = true;
      await syncUserLocation(userId);
      return;
    }

    if (force) {
      await syncUserLocation(userId);
      return;
    }

    const gps = await requestGpsOnly();
    if (shouldSyncForTravel(settings, gps)) {
      await syncUserLocation(userId);
      return;
    }

    // Checked GPS; no travel — skip heavy geocode until cooldown expires.
    lastSyncedUserId = userId;
    lastSyncedAt = Date.now();
  })();
}
