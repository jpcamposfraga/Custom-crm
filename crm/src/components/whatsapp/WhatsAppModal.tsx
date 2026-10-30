'use client';

import React, { useState, useEffect } from 'react';
import type { Lead, MessageTemplate } from '@/types';
import {
  interpolateTemplate,
  generateWhatsAppUrl,
  type WhatsAppPlatform,
} from '@/lib/template-interpolator';
import {
  MessageCircle,
  X,
  Send,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Clock,
  Laptop,
  Smartphone,
  Phone,
} from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSent?: () => void;
}

export function WhatsAppModal({ isOpen, lead, onClose, onSent }: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [platform, setPlatform] = useState<WhatsAppPlatform>('web');

  // Scheduling state
  const [isScheduling, setIsScheduling] = useState<boolean>(false);
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [scheduleSuccess, setScheduleSuccess] = useState<boolean>(false);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && lead) {
      fetchTemplates();
      fetchSettings();

      // Default scheduled time: tomorrow at 09:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const isoLocal = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setScheduledFor(isoLocal);
      setIsScheduling(false);
      setScheduleSuccess(false);
    } else {
      setMessage('');
      setSelectedTemplateId('');
      setCopied(false);
    }
  }, [isOpen, lead]);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.whatsapp_platform === 'app') {
          setPlatform('app');
        } else {
          setPlatform('web');
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        const list: MessageTemplate[] = data.templates || [];
        setTemplates(list);

        if (list.length > 0 && lead) {
          setSelectedTemplateId(list[0].id);
          applyTemplate(list[0].content, lead);
        }
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }

  function applyTemplate(templateContent: string, currentLead: Lead) {
    const city = currentLead.location ? currentLead.location.split(',')[0].trim() : '';

    const interpolated = interpolateTemplate(templateContent, {
      nome: currentLead.name,
      nicho: currentLead.nicho,
      cidade: city,
    });
    setMessage(interpolated);
  }

  function handleTemplateSelect(tmplId: string) {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl && lead) {
      applyTemplate(tmpl.content, lead);
    }
  }

  async function handleSendNow() {
    if (!lead || !message.trim()) return;

    // Direct WhatsApp link (Web or App) - skips intermediate wa.me landing page
    const phoneToUse = lead.normalized_phone || lead.phone;
    const url = generateWhatsAppUrl(phoneToUse, message, platform);

    // Open direct WhatsApp chat with text populated in input field
    window.open(url, '_blank');

    // Update lead status to 'em_contato'
    if (lead.status === 'novo') {
      try {
        await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lead.id, status: 'em_contato' }),
        });
      } catch (err) {
        console.error('Failed to update lead status to em_contato', err);
      }
    }

    if (onSent) onSent();
    onClose();
  }

  async function handleScheduleSubmit() {
    if (!lead || !message.trim() || !scheduledFor) return;

    setLoadingSchedule(true);
    try {
      const res = await fetch('/api/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          message: message.trim(),
          scheduled_for: scheduledFor,
          platform,
        }),
      });

      if (res.ok) {
        setScheduleSuccess(true);
        setTimeout(() => {
          if (onSent) onSent();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Error saving scheduled message:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen || !lead) return null;

  const phoneDigits = (lead.normalized_phone || lead.phone || '').replace(/\D/g, '');
  const isMobile = phoneDigits.length === 11 && phoneDigits[2] === '9';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Mensagem WhatsApp</h2>
              <p className="text-xs text-slate-500">
                Para: <span className="font-semibold text-slate-700">{lead.name}</span> ({lead.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Phone Badge / Notice */}
          <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200/80 rounded-lg p-2 px-3">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {lead.phone}
            </span>
            {isMobile ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                📱 Celular (com WhatsApp provável)
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                ☎️ Fixo (verificar se possui WhatsApp)
              </span>
            )}
          </div>

          {/* Mode Switcher: Enviar Agora vs Agendar */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsScheduling(false)}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                !isScheduling
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              Enviar Agora
            </button>
            <button
              type="button"
              onClick={() => setIsScheduling(true)}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                isScheduling
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Agendar Disparo
            </button>
          </div>

          {/* Template Selector & Platform Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Modelo
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                {platform === 'web' ? (
                  <Laptop className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Abrir via
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as WhatsAppPlatform)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
              >
                <option value="web">WhatsApp Web (Navegador)</option>
                <option value="app">WhatsApp App (Windows)</option>
              </select>
            </div>
          </div>

          {/* Scheduling Date/Time Picker */}
          {isScheduling && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 space-y-2 animate-in fade-in">
              <label className="block text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                Data e Horário do Disparo
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-blue-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
              />
              <p className="text-[11px] text-blue-700">
                A mensagem ficará salva na aba <strong>Agendamentos</strong> pronta para disparo no momento programado.
              </p>
            </div>
          )}

          {/* Editable Live Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Mensagem (editável)
              </label>
              <button
                onClick={handleCopy}
                className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copiar texto
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-slate-800 leading-relaxed font-sans resize-none"
              placeholder="Digite a mensagem para o lead..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {!isScheduling ? (
            <button
              onClick={handleSendNow}
              disabled={!message.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {platform === 'web' ? 'Abrir no WhatsApp Web' : 'Abrir no WhatsApp Desktop'}
            </button>
          ) : (
            <button
              onClick={handleScheduleSubmit}
              disabled={loadingSchedule || !message.trim() || !scheduledFor || scheduleSuccess}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              {scheduleSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Agendado com Sucesso!
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" /> Salvar Agendamento
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
