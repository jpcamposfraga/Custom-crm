export interface WebsiteDetectionResult {
  isProprietary: boolean;
  hasWebsite: boolean;
  url: string | null;
  socialType?: 'instagram' | 'whatsapp' | 'facebook' | 'biolink' | 'other_social';
  socialUrl?: string;
}

const SOCIAL_PATTERNS: Array<{
  type: WebsiteDetectionResult['socialType'];
  regex: RegExp;
}> = [
  { type: 'instagram', regex: /(?:^|\.)(?:instagram\.com|instagr\.am)/i },
  { type: 'whatsapp', regex: /(?:^|\.)(?:wa\.me|whatsapp\.com)/i },
  { type: 'facebook', regex: /(?:^|\.)(?:facebook\.com|fb\.com|fb\.me)/i },
  {
    type: 'biolink',
    regex: /(?:^|\.)(?:linktr\.ee|beacons\.ai|bio\.site|taplink\.cc|campsite\.bio|instabio\.cc|linkr\.bio|direct\.me)/i,
  },
  { type: 'other_social', regex: /(?:^|\.)(?:tiktok\.com|youtube\.com|linkedin\.com)/i },
];

/**
 * Classifies whether a URL points to a real proprietary website or a social profile / biolink.
 */
export function detectWebsiteType(rawUrl?: string | null): WebsiteDetectionResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isProprietary: false, hasWebsite: false, url: null };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || !trimmed.startsWith('http')) {
    return { isProprietary: false, hasWebsite: false, url: null };
  }

  let hostname = '';
  try {
    hostname = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return { isProprietary: false, hasWebsite: false, url: null };
  }

  for (const { type, regex } of SOCIAL_PATTERNS) {
    if (regex.test(hostname)) {
      return {
        isProprietary: false,
        hasWebsite: false,
        url: null,
        socialType: type,
        socialUrl: trimmed,
      };
    }
  }

  return {
    isProprietary: true,
    hasWebsite: true,
    url: trimmed,
  };
}
