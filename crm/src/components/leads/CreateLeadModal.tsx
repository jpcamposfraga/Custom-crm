'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Lead } from '@/types';
import {
  UserPlus,
  X,
  Phone,
  Building,
  Globe,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Tag,
} from 'lucide-react';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (lead: Lead) => void;
  availableNiches?: string[];
}

export function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  availableNiches = [],
}: CreateLeadModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nicho, setNicho] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');

  const [checkingPhone, setCheckingPhone] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<{
    id: string;
    name: string;
    phone: string;
    stage?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone('');
      setNicho('');
      setLocation('');
      setWebsite('');
      setNotes('');
      setDuplicateLead(null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Debounced check for duplicate phone
  useEffect(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      setDuplicateLead(null);
      setCheckingPhone(false);
      return;
    }

    setCheckingPhone(true);
    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(phone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.lead) {
            setDuplicateLead(data.lead);
          } else {
            setDuplicateLead(null);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar telefone:', err);
      } finally {
        setCheckingPhone(false);
      }
    }, 400);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O nome do lead é obrigatório.');
      return;
    }

    if (!phone.trim()) {
      setError('O telefone do lead é obrigatório.');
      return;
    }

    if (duplicateLead) {
      setError(`O telefone já está cadastrado para "${duplicateLead.name}". Não é permitido cadastrar duplicados.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          nicho: nicho.trim() || 'Geral',
          location: location.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
          status: 'novo',
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(data.error || 'Este telefone já está cadastrado.');
        if (data.existingLead) {
          setDuplicateLead(data.existingLead);
        }
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Erro ao criar lead.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess && data.lead) {
          onSuccess(data.lead);
        }
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao salvar lead.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Novo Lead</h2>
              <p className="text-xs text-slate-500">
                Cadastre um contato comercial individualmente no CRM
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              Nome / Empresa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Consultório Dr. Lucas Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
            />
          </div>

          {/* Telefone with real-time duplication indicator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                Telefone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              {checkingPhone && (
                <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                </span>
              )}
            </div>

            <input
              type="text"
              required
              placeholder="Ex: (19) 99876-5432"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full text-xs p-2.5 rounded-lg border outline-none transition-all ${
                duplicateLead
                  ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white'
              }`}
            />

            {/* Duplicate phone warning box */}
            {duplicateLead && (
              <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-tight space-y-0.5">
                  <p className="font-bold">Telefone já cadastrado no sistema!</p>
                  <p className="text-[11px] text-rose-700">
                    Pertence a <strong>{duplicateLead.name}</strong>
                    {duplicateLead.stage ? ` (Etapa: ${duplicateLead.stage})` : ''}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Nicho e Localização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                Nicho / Ramo
              </label>
              <input
                type="text"
                list="niches-list"
                placeholder="Ex: Odontologia"
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
              />
              <datalist id="niches-list">
                {availableNiches.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Localização / Cidade
              </label>
              <input
                type="text"
                placeholder="Ex: Campinas, SP"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              Website / Instagram (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: https://clinica.com.br"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
            />
          </div>

          {/* Observações / Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Observações / Notas
            </label>
            <textarea
              rows={3}
              placeholder="Detalhes sobre a prospecção, decisor, horário de contato..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 resize-none transition-all"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting || !!duplicateLead || success || !name.trim() || !phone.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Lead Cadastrado!
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" /> Cadastrar Lead
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
