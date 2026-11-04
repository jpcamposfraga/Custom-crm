'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Laptop,
  Smartphone,
  Check,
  Save,
  MessageCircle,
  ShieldCheck,
  Zap,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Power,
  FileText,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import type { WhatsAppPlatform } from '@/lib/template-interpolator';

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function SettingsPage() {
  const [platform, setPlatform] = useState<WhatsAppPlatform>('web');
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'waiting_qr' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savedPlatformSuccess, setSavedPlatformSuccess] = useState(false);
  const [savingAutoSend, setSavingAutoSend] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Poll for QR Code scan / connection status when waiting for QR
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (connectionStatus === 'waiting_qr') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp/status');
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'connected') {
              setConnectionStatus('connected');
              setQrCode(null);
              if (data.autoSendEnabled !== undefined) {
                setAutoSendEnabled(data.autoSendEnabled);
              } else {
                setAutoSendEnabled(true);
              }
            } else if (data.status === 'waiting_qr' && data.qrCode) {
              setQrCode(data.qrCode);
            }
          }
        } catch (e) {}
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionStatus]);

  async function fetchInitialData() {
    try {
      // 1. Fetch general settings
      const resSettings = await fetch('/api/settings');
      if (resSettings.ok) {
        const data = await resSettings.json();
        if (data.settings?.whatsapp_platform) {
          setPlatform(data.settings.whatsapp_platform as WhatsAppPlatform);
        }
        if (data.settings?.auto_send_whatsapp) {
          setAutoSendEnabled(data.settings.auto_send_whatsapp === 'true');
        }
      }

      // 2. Fetch WhatsApp session status
      const resStatus = await fetch('/api/whatsapp/status');
      if (resStatus.ok) {
        const statusData = await resStatus.json();
        setConnectionStatus(statusData.status || 'disconnected');
        if (statusData.qrCode) {
          setQrCode(statusData.qrCode);
        }
        if (statusData.autoSendEnabled !== undefined) {
          setAutoSendEnabled(statusData.autoSendEnabled);
        }
      }

      // 3. Fetch message templates
      const resTemplates = await fetch('/api/templates');
      if (resTemplates.ok) {
        const tmplData = await resTemplates.json();
        setTemplates(tmplData.templates || []);
      }
    } catch (err) {
      console.error('Error fetching settings/status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreatingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [...prev, data.template]);
        setNewTitle('');
        setNewContent('');
        setIsAddingTemplate(false);
      }
    } catch (err) {
      console.error('Error creating template:', err);
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este modelo de mensagem?')) return;
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  }

  async function handleSavePlatform() {
    setSavingPlatform(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'whatsapp_platform', value: platform }),
      });

      if (res.ok) {
        setSavedPlatformSuccess(true);
        setTimeout(() => setSavedPlatformSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Error saving platform:', err);
    } finally {
      setSavingPlatform(false);
    }
  }

  async function handleToggleAutoSend(nextState: boolean) {
    setSavingAutoSend(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'auto_send_whatsapp', value: String(nextState) }),
      });

      if (res.ok) {
        setAutoSendEnabled(nextState);
      }
    } catch (err) {
      console.error('Error saving auto_send setting:', err);
    } finally {
      setSavingAutoSend(false);
    }
  }

  async function handleConnectWhatsApp() {
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus(data.status);
        if (data.qrCode) {
          setQrCode(data.qrCode);
        }
        if (data.status === 'connected') {
          setAutoSendEnabled(true);
        }
      }
    } catch (err) {
      console.error('Error connecting WhatsApp:', err);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnectWhatsApp() {
    if (!window.confirm('Tem certeza que deseja desconectar a sessão do WhatsApp do CRM?')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (res.ok) {
        setConnectionStatus('disconnected');
        setQrCode(null);
        setAutoSendEnabled(false);
      }
    } catch (err) {
      console.error('Error disconnecting WhatsApp:', err);
    } finally {
      setDisconnecting(false);
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
          {/* Card: Headless Auto-Send & QR Code Integration */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <h2>Envio Automático do WhatsApp (Headless)</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Permite que mensagens agendadas e disparos no modal sejam enviados 100% sozinhos sem abrir janelas e sem precisar apertar Enter.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {connectionStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Conectado ao WhatsApp
                  </span>
                )}
                {connectionStatus === 'waiting_qr' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <QrCode className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    Aguardando Leitura do QR Code
                  </span>
                )}
                {connectionStatus === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <Power className="w-3.5 h-3.5 text-slate-400" />
                    Desconectado
                  </span>
                )}
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-1">
                <label htmlFor="auto-send-toggle" className="text-sm font-bold text-slate-900 cursor-pointer">
                  Habilitar envio 100% automático (sem confirmação manual)
                </label>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Por padrão fica desativado. Quando ligado e conectado via QR Code, as mensagens agendadas vencidas e os envios marcados no modal serão enviados automaticamente pelo robô do Playwright em segundo plano.
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                <button
                  type="button"
                  id="auto-send-toggle"
                  role="switch"
                  aria-checked={autoSendEnabled}
                  disabled={savingAutoSend}
                  onClick={() => handleToggleAutoSend(!autoSendEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoSendEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoSendEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Connection Area */}
            {connectionStatus === 'disconnected' && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-50/50 border border-blue-200 rounded-xl gap-4">
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-semibold">Nenhuma conta do WhatsApp conectada</p>
                  <p className="text-blue-700">
                    Clique em Conectar para gerar o QR Code e parear seu WhatsApp uma única vez neste computador.
                  </p>
                </div>
                <button
                  onClick={handleConnectWhatsApp}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Iniciando Navegador...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" /> Conectar WhatsApp
                    </>
                  )}
                </button>
              </div>
            )}

            {connectionStatus === 'waiting_qr' && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">Escaneie o QR Code abaixo com seu celular</h3>
                  <p className="text-xs text-slate-500">
                    1. Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong>.
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-300 rounded-xl shadow-md">
                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="w-60 h-60 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-60 h-60 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Carregando QR Code do WhatsApp...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConnectWhatsApp}
                    disabled={connecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} /> Recarregar QR Code
                  </button>
                  <button
                    onClick={handleDisconnectWhatsApp}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 bg-white border border-rose-200 rounded-lg shadow-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {connectionStatus === 'connected' && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl gap-4">
                <div className="text-xs text-emerald-950 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Sessão autenticada e pronta para disparo automático
                  </p>
                  <p className="text-emerald-700">
                    O robô do Playwright está conectado ao seu WhatsApp neste computador. As mensagens agendadas serão enviadas na data e hora exatas.
                  </p>
                </div>

                <button
                  onClick={handleDisconnectWhatsApp}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg shadow-sm transition-all whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" /> Desconectar WhatsApp
                </button>
              </div>
            )}
          </div>

          {/* Card: WhatsApp Fallback Link Preference */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h2>Método Padrão de Envio (Fallback / Manual)</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Escolha como você deseja que as mensagens sejam abertas quando o envio automático estiver desativado ou ao clicar no botão manual nos leads.
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
                onClick={handleSavePlatform}
                disabled={savingPlatform}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                {savedPlatformSuccess ? (
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

          {/* Card: Message Templates */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h2>Modelos de Mensagem (Templates)</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Gerencie os modelos pré-definidos para abordar seus leads. As tags <code>[nome]</code>, <code>[local]</code> (ou <code>[cidade]</code>) e <code>[nicho]</code> são substituídas automaticamente pelos dados reais de cada contato.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingTemplate ? 'Cancelar' : 'Novo Modelo'}
              </button>
            </div>

            {/* Create Template Form */}
            {isAddingTemplate && (
              <form onSubmit={handleCreateTemplate} className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Criar Novo Modelo
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Título do Modelo
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Proposta para Psicólogas"
                    required
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Conteúdo da Mensagem
                  </label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={4}
                    placeholder="Ex: Oi [nome], tudo bem? Encontrei sua clínica em [local]..."
                    required
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 leading-relaxed font-sans"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Dica: use <code>[nome]</code> para o nome do lead, <code>[local]</code> ou <code>[cidade]</code> para a localização, e <code>[nicho]</code> para o segmento.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTemplate(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    {creatingTemplate ? 'Salvando...' : 'Salvar Modelo'}
                  </button>
                </div>
              </form>
            )}

            {/* Template List */}
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum modelo cadastrado.</p>
              ) : (
                templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2 relative group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{tmpl.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {tmpl.id}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition-colors"
                        title="Excluir Modelo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200/60">
                      {tmpl.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card: System Info */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3 text-xs text-slate-600">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Arquitetura &amp; Privacidade Local
            </h3>
            <p>
              Este CRM foi arquitetado para rodar de forma 100% autônoma e local no seu computador. Todas as informações de leads, quadros Kanban e agendamentos ficam salvas no arquivo <code>crm.db</code> (SQLite via LibSQL), e a sessão do WhatsApp é guardada exclusivamente na sua máquina (<code>.whatsapp-session</code>), sem servidores intermediários ou envio de dados a terceiros.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
