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

export function generateWhatsAppUrl(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${encodedText}`;
}
