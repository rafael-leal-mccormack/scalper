import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface AuthData {
  // UberEats fields
  sid?: string;
  jwtSession?: string;
  jwtSessionUem?: string;
  cfClearance?: string;
  selectedRestaurant?: string;
  udiId?: string;
  udiFingerprint?: string;
  csrfToken?: string;

  // DoorDash fields
  ddwebMxPortalToken?: string;
  portalWebSid?: string;
  ddDeviceId?: string;
  ddSessionId?: string;
  ddDeviceSessionId?: string;
  ddAttKey?: string;
  storeId?: string;
  storeName?: string;
  businessId?: string;
  cookies?: string;

  timestamp: number;
}

const AUTH_CACHE_DIR = join(process.cwd(), '.cache');
const MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 hours

function getAuthCacheFile(platform: string = 'ubereats'): string {
  return join(AUTH_CACHE_DIR, `${platform}_auth.json`);
}

export function saveAuthCache(authData: Omit<AuthData, 'timestamp'>, platform: string = 'ubereats'): void {
  try {
    // Create cache directory if it doesn't exist
    if (!existsSync(AUTH_CACHE_DIR)) {
      mkdirSync(AUTH_CACHE_DIR, { recursive: true });
    }

    const cacheData: AuthData = {
      ...authData,
      timestamp: Date.now()
    };

    const authCacheFile = getAuthCacheFile(platform);
    writeFileSync(authCacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`\n✓ ${platform} authentication cached successfully`);
  } catch (error) {
    console.error(`\n⚠️  Failed to save ${platform} auth cache:`, error);
  }
}

export function loadAuthCache(platform: string = 'ubereats'): Omit<AuthData, 'timestamp'> | null {
  try {
    const authCacheFile = getAuthCacheFile(platform);

    if (!existsSync(authCacheFile)) {
      console.log(`\n⚠️  No cached ${platform} authentication found`);
      return null;
    }

    const cacheData: AuthData = JSON.parse(readFileSync(authCacheFile, 'utf-8'));
    const age = Date.now() - cacheData.timestamp;

    if (age > MAX_AGE_MS) {
      const hoursOld = Math.floor(age / (60 * 60 * 1000));
      console.log(`\n⚠️  Cached ${platform} authentication expired (${hoursOld} hours old)`);
      return null;
    }

    const hoursRemaining = Math.floor((MAX_AGE_MS - age) / (60 * 60 * 1000));
    console.log(`\n✓ Using cached ${platform} authentication (valid for ${hoursRemaining} more hours)`);

    const { timestamp, ...authData } = cacheData;
    return authData;
  } catch (error) {
    console.error(`\n⚠️  Failed to load ${platform} auth cache:`, error);
    return null;
  }
}
