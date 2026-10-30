'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Laptop,
  Smartphone,
  Check,
  Save,
  MessageCircle,
  Database,
  ShieldCheck,
} from 'lucide-react';
import type { WhatsAppPlatform } from '@/lib/template-interpolator';

export default function SettingsPage() {
  const [platform, setPlatform] = useState<WhatsAppPlatform>('web');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.whatsapp_platform) {
          setPlatform(data.settings.whatsapp_platform as WhatsAppPlatform);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'whatsapp_platform', value: platform }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" /> Configurações
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Personalize as preferências de disparo de mensagens e integrações do seu CRM.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs">Carregando configurações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card: WhatsApp Integration Preference */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h2>Método de Envio do WhatsApp</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Escolha como você deseja que as mensagens sejam abertas ao clicar no botão do WhatsApp nos leads. Ambos os métodos pulam a tela intermediária do wa.me e anexam a mensagem diretamente no campo de texto.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Option 1: WhatsApp Web */}
              <div
                onClick={() => setPlatform('web')}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all relative ${
                  platform === 'web'
                    ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mb-3">
                    <Laptop className="w-5 h-5" />
                  </div>
                  {platform === 'web' && (
                    <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">WhatsApp Web (Navegador)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Abre uma nova aba direto em <code>web.whatsapp.com/send</code>. Ideal se você costuma trabalhar com o WhatsApp aberto no Chrome, Edge ou Brave.
                </p>
              </div>

              {/* Option 2: WhatsApp App Desktop */}
              <div
                onClick={() => setPlatform('app')}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all relative ${
                  platform === 'app'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mb-3">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  {platform === 'app' && (
                    <div className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">WhatsApp Desktop App (Windows)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Abre diretamente o aplicativo do WhatsApp instalado no Windows (via <code>whatsapp://send</code>). Sem abrir novas abas no navegador.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Preferência ativa: <strong>{platform === 'web' ? 'WhatsApp Web' : 'Aplicativo Windows'}</strong>
              </span>

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" /> Salvo com Sucesso!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Salvar Preferência
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card: System Info */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3 text-xs text-slate-600">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Arquitetura & Privacidade Local
            </h3>
            <p>
              Este CRM foi arquitetado para rodar de forma 100% autônoma e local no seu computador. Todas as informações de leads, quadros Kanban e agendamentos ficam salvas no arquivo <code>crm.db</code> (SQLite via LibSQL), sem envio de dados para servidores externos ou custos de APIs pagas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
