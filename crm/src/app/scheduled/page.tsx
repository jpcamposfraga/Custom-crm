'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { generateWhatsAppUrl, type WhatsAppPlatform } from '@/lib/template-interpolator';

interface ScheduledMessageItem {
  id: string;
  lead_id: string;
  message: string;
  scheduled_for: string;
  status: 'pendente' | 'enviado' | 'cancelado';
  platform: 'web' | 'app';
  created_at: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_normalized_phone: string | null;
  lead_nicho: string | null;
}

export default function ScheduledPage() {
  const [messages, setMessages] = useState<ScheduledMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todas' | 'pendente' | 'enviado' | 'cancelado'>('pendente');

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch('/api/scheduled-messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.scheduledMessages || []);
      }
    } catch (err) {
      console.error('Error fetching scheduled messages:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendNow(item: ScheduledMessageItem) {
    const phone = item.lead_normalized_phone || item.lead_phone;
    if (!phone) {
      alert('Este lead não possui telefone cadastrado.');
      return;
    }

    const url = generateWhatsAppUrl(phone, item.message, item.platform);
    window.open(url, '_blank');

    // Update status to 'enviado'
    try {
      await fetch('/api/scheduled-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'enviado' }),
      });
      fetchMessages();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }

  async function handleUpdateStatus(id: string, status: 'cancelado' | 'pendente') {
    try {
      await fetch('/api/scheduled-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      fetchMessages();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este agendamento?')) return;
    try {
      await fetch(`/api/scheduled-messages?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      fetchMessages();
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  }

  const filteredMessages = messages.filter((m) => {
    if (filter === 'todas') return true;
    return m.status === filter;
  });

  const statusBadge = {
    pendente: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Pendente' },
    enviado: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Enviado' },
    cancelado: { bg: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Cancelado' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" /> Mensagens Agendadas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhe suas mensagens programadas e dispare no WhatsApp com 1 clique no horário desejado.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          {(['pendente', 'todas', 'enviado', 'cancelado'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'todas' ? 'Todas' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs">Carregando agendamentos...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Nenhum agendamento encontrado</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Ao abrir o modal do WhatsApp em um lead, escolha a opção &quot;Agendar Disparo&quot; para programar contatos futuros.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMessages.map((item) => {
            const badge = statusBadge[item.status] || statusBadge.pendente;
            const scheduledDate = new Date(item.scheduled_for);
            const dateStr = isNaN(scheduledDate.getTime())
              ? item.scheduled_for
              : scheduledDate.toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {dateStr}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{item.lead_name || 'Lead sem nome'}</h3>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {item.lead_phone || 'Sem telefone'}
                    </span>
                    {item.lead_nicho && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                        {item.lead_nicho}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message preview */}
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs text-slate-700 italic line-clamp-3">
                  &ldquo;{item.message}&rdquo;
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>Via:</span>
                    <span className="font-semibold text-slate-600">
                      {item.platform === 'app' ? 'App Desktop' : 'WhatsApp Web'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.status === 'pendente' && (
                      <>
                        <button
                          onClick={() => handleSendNow(item)}
                          title="Disparar no WhatsApp e marcar como enviado"
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          Disparar
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'cancelado')}
                          title="Cancelar agendamento"
                          className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {item.status === 'cancelado' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'pendente')}
                        title="Reativar agendamento"
                        className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        Reativar
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Excluir"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
