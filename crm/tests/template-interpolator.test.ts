import { describe, it, expect } from 'vitest';
import { interpolateTemplate, generateWhatsAppUrl } from '../src/lib/template-interpolator';

describe('WhatsApp Template Interpolator & URL Generator', () => {
  it('interpolates template tags {nome}, {nicho}, {cidade}', () => {
    const template = 'Olá {nome}, vi sua clínica de {nicho} em {cidade}!';
    const vars = {
      nome: 'Dr. João',
      nicho: 'Odontologia',
      cidade: 'Campinas',
    };

    const result = interpolateTemplate(template, vars);
    expect(result).toBe('Olá Dr. João, vi sua clínica de Odontologia em Campinas!');
  });

  it('handles missing variables gracefully without leaving raw braces', () => {
    const template = 'Olá {nome}! Vi sua empresa de {nicho} em {cidade}.';
    const vars = {
      nome: 'Maria',
      nicho: 'Estética',
    };

    const result = interpolateTemplate(template, vars);
    expect(result).toBe('Olá Maria! Vi sua empresa de Estética em sua região.');
  });

  it('generates valid WhatsApp click-to-chat URL with proper encoding', () => {
    const phone = '11987654321';
    const message = 'Olá João! Tudo bem? 🚀';

    const url = generateWhatsAppUrl(phone, message);
    expect(url).toContain('https://wa.me/5511987654321?text=');
    expect(url).toContain(encodeURIComponent(message));
  });

  it('handles phone already having 55 prefix cleanly', () => {
    const phone = '5511987654321';
    const message = 'Teste';

    const url = generateWhatsAppUrl(phone, message);
    expect(url).toBe('https://wa.me/5511987654321?text=Teste');
  });
});
