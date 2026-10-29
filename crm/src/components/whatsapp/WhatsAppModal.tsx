'use client';

import React, { useState, useEffect } from 'react';
import type { Lead, MessageTemplate } from '@/types';
import { interpolateTemplate, generateWhatsAppUrl } from '@/lib/template-interpolator';
import { MessageCircle, X, Send, Copy, Check, Sparkles } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen && lead) {
      fetchTemplates();
    } else {
      setMessage('');
      setSelectedTemplateId('');
      setCopied(false);
    }
  }, [isOpen, lead]);

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
    // Extract city if location is "City, State"
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

  async function handleSend() {
    if (!lead || !message.trim()) return;

    // Open WhatsApp Click-to-Chat in new tab
    const url = generateWhatsAppUrl(lead.normalized_phone || lead.phone, message);
    window.open(url, '_blank');

    // If lead status is 'novo', mark as 'em_contato'
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

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen || !lead) return null;

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
              <h2 className="text-base font-bold text-slate-800">Enviar WhatsApp</h2>
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
          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Modelo de Mensagem
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
            >
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.title}
                </option>
              ))}
            </select>
          </div>

          {/* Editable Live Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Prévia da Mensagem (editável)
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
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-slate-800 leading-relaxed font-sans resize-none"
              placeholder="Digite a mensagem para o lead..."
            />
          </div>

          {/* Variables help badge */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Dica:</span> As variáveis{' '}
            <code className="text-emerald-700 font-mono">{"{nome}"}</code>,{' '}
            <code className="text-emerald-700 font-mono">{"{nicho}"}</code> e{' '}
            <code className="text-emerald-700 font-mono">{"{cidade}"}</code> são preenchidas
            automaticamente com os dados do lead.
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
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Abrir no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
