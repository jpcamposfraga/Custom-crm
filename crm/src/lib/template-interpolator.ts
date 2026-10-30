export type WhatsAppPlatform = 'web' | 'app' | 'wame';

export function interpolateTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  let result = template;

  const fallbacks: Record<string, string> = {
    nome: 'você',
    nicho: 'seu segmento',
    cidade: 'sua região',
  };

  result = result.replace(/\{(\w+)\}/g, (match, key) => {
    const val = vars[key];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
    return fallbacks[key] || '';
  });

  return result;
}

export function generateWhatsAppUrl(
  phone: string,
  text: string,
  platform: WhatsAppPlatform = 'web'
): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  const encodedText = encodeURIComponent(text);

  if (platform === 'app') {
    return `whatsapp://send?phone=${digits}&text=${encodedText}`;
  }

  if (platform === 'wame') {
    return `https://wa.me/${digits}?text=${encodedText}`;
  }

  // Direct WhatsApp Web (default for desktop: skips intermediate wa.me page and populates input box)
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodedText}`;
}
