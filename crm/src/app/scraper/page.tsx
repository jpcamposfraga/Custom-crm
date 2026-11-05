'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Compass,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Loader2,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  StopCircle,
  Check,
  Star,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { ScrapedLead } from '@/lib/maps-crawler';

interface IngestionSummary {
  totalReceived: number;
  insertedCount: number;
  duplicatesCount: number;
  cardsCreated: number;
}

const QUICK_NICHES = [
  'Psicólogas',
  'Dentistas',
  'Nutricionistas',
  'Clínicas de Estética',
  'Advogados',
  'Academias',
];

export default function ScraperPage() {
  const [nicho, setNicho] = useState('');
  const [regiao, setRegiao] = useState('');
  const [quantidade, setQuantidade] = useState<number>(20);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 20 });
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedLeads, setExtractedLeads] = useState<ScrapedLead[]>([]);
  const [summary, setSummary] = useState<IngestionSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicho.trim() && !regiao.trim()) {
      setErrorMessage('Preencha ao menos o Nicho ou a Região.');
      return;
    }

    setErrorMessage(null);
    setIsRunning(true);
    setSummary(null);
    setExtractedLeads([]);
    setCurrentProgress({ current: 0, total: quantidade });
    setLogs([`[${new Date().toLocaleTimeString()}] 🚀 Iniciando conexão com o Google Maps...`]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/scraper/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicho: nicho.trim(),
          regiao: regiao.trim(),
          limite: quantidade,
          onlyWithoutWebsite,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Não foi possível ler o fluxo de dados (SSE).');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const lines = rawEvent.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              eventData = line.replace('data:', '').trim();
            }
          }

          if (!eventData) continue;

          try {
            const data = JSON.parse(eventData);

            if (eventType === 'start') {
              setStatusMessage(`Buscando "${data.query}"...`);
              setCurrentProgress({ current: 0, total: data.limit });
            } else if (eventType === 'progress') {
              setCurrentProgress({ current: data.current, total: data.total });
              if (data.lead) {
                setExtractedLeads((prev) => [data.lead, ...prev]);
                const webInfo = data.lead.socialType
                  ? `[${data.lead.socialType.toUpperCase()}] Sem site próprio`
                  : data.lead.hasWebsite
                  ? 'Com site próprio'
                  : 'Sem site';
                setLogs((prev) => [
                  `[${new Date().toLocaleTimeString()}] ✅ ${data.lead.name} (${data.lead.phone || 'Sem tel'}) - ${webInfo}`,
                  ...prev.slice(0, 40),
                ]);
              } else if (data.leadName) {
                setLogs((prev) => [
                  `[${new Date().toLocaleTimeString()}] ℹ️ ${data.leadName}`,
                  ...prev.slice(0, 40),
                ]);
              }
            } else if (eventType === 'ingesting') {
              setStatusMessage('Salvando leads e gerando cartões no Kanban...');
              setLogs((prev) => [
                `[${new Date().toLocaleTimeString()}] 💾 Ingerindo ${data.totalFound} lead(s) no banco de dados e Kanban...`,
                ...prev.slice(0, 40),
              ]);
            } else if (eventType === 'complete') {
              setSummary(data.summary);
              if (data.leads && Array.isArray(data.leads)) {
                setExtractedLeads(data.leads);
              }
              setStatusMessage('Extração concluída com sucesso!');
              setLogs((prev) => [
                `[${new Date().toLocaleTimeString()}] 🎉 Finalizado! Inseridos: ${data.summary.insertedCount}, Duplicados: ${data.summary.duplicatesCount}`,
                ...prev.slice(0, 40),
              ]);
            } else if (eventType === 'error') {
              setErrorMessage(data.message);
              setLogs((prev) => [
                `[${new Date().toLocaleTimeString()}] ❌ Erro: ${data.message}`,
                ...prev.slice(0, 40),
              ]);
            }
          } catch {
            // Ignored invalid JSON chunk
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ⏹️ Extração cancelada pelo usuário.`,
          ...prev,
        ]);
        setStatusMessage('Extração cancelada.');
      } else {
        setErrorMessage(err.message || 'Falha na requisição.');
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const progressPercentage =
    currentProgress.total > 0
      ? Math.min(Math.round((currentProgress.current / currentProgress.total) * 100), 100)
      : 0;

  const leadsWithoutProprietaryWebsite = extractedLeads.filter((l) => !l.isProprietaryWebsite);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Compass className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Extrair Leads</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Busca leads no Google Maps em tempo real e insere direto no seu CRM e Funil Kanban.
          </p>
        </div>

        {summary && (
          <div className="flex items-center gap-2">
            <Link
              href="/kanban"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              Ver no Kanban
            </Link>
            <Link
              href="/leads"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-600" />
              Ver Tabela de Leads
            </Link>
          </div>
        )}
      </div>

      {/* Main Search Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleStartExtraction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Nicho Field */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Nicho / Segmento
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: Psicólogas, Dentistas..."
                  value={nicho}
                  onChange={(e) => setNicho(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Quick Nicho Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_NICHES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNicho(chip)}
                    disabled={isRunning}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                      nicho === chip
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Região Field */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Região / Cidade
              </label>
              <input
                type="text"
                placeholder="Ex: Campinas SP, Moema São Paulo..."
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                disabled={isRunning}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-slate-400">
                Adicione a sigla do estado para maior precisão (ex: SP, MG, RJ).
              </p>
            </div>

            {/* Quantidade Field */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Quantidade de Leads
              </label>
              <select
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                disabled={isRunning}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value={10}>10 leads</option>
                <option value={20}>20 leads (Recomendado)</option>
                <option value={50}>50 leads</option>
                <option value={100}>100 leads</option>
              </select>
              <p className="text-[11px] text-slate-400">
                O crawler navega até atingir essa quantidade exata de contatos válidos.
              </p>
            </div>
          </div>

          {/* Proprietary Website Filter Toggle */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
            <div className="pt-0.5">
              <input
                id="onlyWithoutWebsite"
                type="checkbox"
                checked={onlyWithoutWebsite}
                onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 text-blue-600 rounded border-amber-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <label htmlFor="onlyWithoutWebsite" className="cursor-pointer text-xs space-y-1">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 inline" />
                Filtrar apenas negócios sem site próprio (Recomendado para venda de sites)
              </span>
              <p className="text-amber-800 leading-relaxed">
                Empresas com sites reais serão ignoradas. <strong>Atenção à armadilha:</strong> negócios que colocaram o link do Instagram, WhatsApp ou Linktree como website no Google Maps serão capturados como <strong>SEM site próprio</strong>!
              </p>
            </label>
          </div>

          {/* Actions & Feedback */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div>
              {errorMessage && (
                <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {statusMessage && !errorMessage && (
                <div className="flex items-center gap-2 text-slate-600 text-xs font-medium">
                  {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <StopCircle className="w-4 h-4" />
                  Cancelar
                </button>
              ) : (
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Search className="w-4 h-4" />
                  Iniciar Extração
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Live Progress Bar & Activity Console */}
      {isRunning && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Progresso da Raspagem Google Maps
            </span>
            <span className="font-mono text-blue-600">
              [{currentProgress.current} / {currentProgress.total}] {progressPercentage}%
            </span>
          </div>

          {/* Progress Track */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Live Activity Console */}
          <div className="mt-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Terminal de Atividades ao Vivo
            </p>
            <div className="bg-slate-900 rounded-xl p-3.5 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Total Encontrados</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{summary.totalReceived}</p>
          </div>

          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <p className="text-xs font-semibold text-emerald-800">Novos Cadastrados no CRM</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{summary.insertedCount}</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Duplicados Ignorados</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{summary.duplicatesCount}</p>
          </div>

          <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 shadow-xs">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Sem Site Próprio
            </p>
            <p className="text-2xl font-black text-amber-700 mt-1">
              {leadsWithoutProprietaryWebsite.length}
            </p>
          </div>
        </div>
      )}

      {/* Discovered Leads Preview Table */}
      {extractedLeads.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Leads Extraídos ({extractedLeads.length})
            </h2>
            <span className="text-xs text-slate-500">
              {summary ? 'Salvos automaticamente no banco' : 'Processando...'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Empresa / Nome</th>
                  <th className="px-6 py-3">Telefone</th>
                  <th className="px-6 py-3">Website / Presença</th>
                  <th className="px-6 py-3">Avaliação</th>
                  <th className="px-6 py-3">Endereço / Cidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extractedLeads.map((lead, idx) => {
                  const hasProprietary = lead.isProprietaryWebsite;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {lead.googleMapsUrl ? (
                          <a
                            href={lead.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600"
                          >
                            {lead.name}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : (
                          lead.name
                        )}
                        <div className="text-[11px] font-normal text-slate-500">{lead.nicho}</div>
                      </td>

                      <td className="px-6 py-3.5 font-mono text-slate-700">
                        {lead.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span>{lead.phone}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(lead.phone)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                              title="Copiar telefone"
                            >
                              {copiedPhone === lead.phone ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sem telefone</span>
                        )}
                      </td>

                      <td className="px-6 py-3.5">
                        {lead.socialType === 'instagram' ? (
                          <a
                            href={lead.socialUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                          >
                            🟣 Sem site (Instagram)
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : lead.socialType === 'whatsapp' ? (
                          <a
                            href={lead.socialUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          >
                            🟢 Sem site (WhatsApp)
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : lead.socialType === 'biolink' ? (
                          <a
                            href={lead.socialUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          >
                            🟡 Sem site (Linktree/Bio)
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : hasProprietary && lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 max-w-[160px] truncate"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                            <Globe className="w-3 h-3 text-amber-600 opacity-60" />
                            Sem website
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-slate-700">
                        {lead.rating !== undefined && lead.rating !== null ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-bold">{lead.rating}</span>
                            {lead.reviewsCount && (
                              <span className="text-slate-400 text-[10px]">({lead.reviewsCount})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-slate-600 max-w-[200px] truncate">
                        {lead.location || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
