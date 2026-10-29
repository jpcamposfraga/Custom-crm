export interface ScrapedLead {
  name: string;
  phone: string;
  normalizedPhone: string;
  nicho: string;
  hasWebsite: boolean;
  website?: string;
  location?: string;
  rating?: number;
  reviewsCount?: number;
  googleMapsUrl?: string;
}

export interface PhoneNormalizationResult {
  normalized: string;
  formatted: string;
  isValid: boolean;
}
