import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface AuthData {
  sid?: string;
  jwtSession?: string;
  jwtSessionUem?: string;
  cfClearance?: string;
  selectedRestaurant?: string;
  udiId?: string;
  udiFingerprint?: string;
  csrfToken?: string;
  timestamp: number;
}

const AUTH_CACHE_DIR = join(process.cwd(), '.cache');
const AUTH_CACHE_FILE = join(AUTH_CACHE_DIR, 'ubereats_auth.json');
const MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 hours

export function saveAuthCache(authData: Omit<AuthData, 'timestamp'>): void {
  try {
    // Create cache directory if it doesn't exist
    if (!existsSync(AUTH_CACHE_DIR)) {
      mkdirSync(AUTH_CACHE_DIR, { recursive: true });
    }

    const cacheData: AuthData = {
      ...authData,
      timestamp: Date.now()
    };

    writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log('\n✓ Authentication cached successfully');
  } catch (error) {
    console.error('\n⚠️  Failed to save auth cache:', error);
  }
}

export function loadAuthCache(): Omit<AuthData, 'timestamp'> | null {
  try {
    if (!existsSync(AUTH_CACHE_FILE)) {
      console.log('\n⚠️  No cached authentication found');
      return null;
    }

    const cacheData: AuthData = JSON.parse(readFileSync(AUTH_CACHE_FILE, 'utf-8'));
    const age = Date.now() - cacheData.timestamp;

    if (age > MAX_AGE_MS) {
      const hoursOld = Math.floor(age / (60 * 60 * 1000));
      console.log(`\n⚠️  Cached authentication expired (${hoursOld} hours old)`);
      return null;
    }

    const hoursRemaining = Math.floor((MAX_AGE_MS - age) / (60 * 60 * 1000));
    console.log(`\n✓ Using cached authentication (valid for ${hoursRemaining} more hours)`);

    const { timestamp, ...authData } = cacheData;
    return authData;
  } catch (error) {
    console.error('\n⚠️  Failed to load auth cache:', error);
    return null;
  }
}
