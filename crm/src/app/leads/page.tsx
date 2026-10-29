'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Lead, LeadStatus } from '@/types';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { WhatsAppModal } from '@/components/whatsapp/WhatsAppModal';
import { Users, UserCheck, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [nicho, setNicho] = useState('');
  const [status, setStatus] = useState('');
  const [hasWebsite, setHasWebsite] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // WhatsApp modal state
  const [selectedWhatsAppLead, setSelectedWhatsAppLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (nicho) params.set('nicho', nicho);
      if (status) params.set('status', status);
      if (hasWebsite) params.set('has_website', hasWebsite);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        if (data.niches) {
          setNiches(data.niches);
        }
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  }, [search, nicho, status, hasWebsite, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    try {
      // optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );

      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update lead status', err);
      fetchLeads();
    }
  }

  async function handleDeleteLead(leadId: string) {
    if (!confirm('Deseja realmente remover este lead?')) return;
    try {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      await fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete lead', err);
      fetchLeads();
    }
  }

  function handleResetFilters() {
    setSearch('');
    setNicho('');
    setStatus('');
    setHasWebsite('');
    setSortBy('created_at');
    setSortOrder('desc');
  }

  // Summary Metrics
  const total = leads.length;
  const converted = leads.filter((l) => l.status === 'convertido').length;
  const inContact = leads.filter((l) => l.status === 'em_contato').length;
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Gestão de Leads
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Visualize, filtre e interaja rapidamente com seus contatos comerciais prospectados.
          </p>
        </div>

        {/* Quick stats chips */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-500">Total:</span>
            <span className="font-bold text-slate-800">{total}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-500">Em Contato:</span>
            <span className="font-bold text-slate-800">{inContact}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500">Conversão:</span>
            <span className="font-bold text-emerald-700">{converted} ({conversionRate}%)</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <LeadFilters
        search={search}
        onSearchChange={setSearch}
        nicho={nicho}
        onNichoChange={setNicho}
        availableNiches={niches}
        status={status}
        onStatusChange={setStatus}
        hasWebsite={hasWebsite}
        onHasWebsiteChange={setHasWebsite}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onReset={handleResetFilters}
      />

      {/* Main Table */}
      <LeadsTable
        leads={leads}
        loading={loading}
        onStatusChange={handleStatusChange}
        onDeleteLead={handleDeleteLead}
        onOpenWhatsApp={(lead) => setSelectedWhatsAppLead(lead)}
      />

      {/* WhatsApp Modal */}
      {selectedWhatsAppLead && (
        <WhatsAppModal
          isOpen={!!selectedWhatsAppLead}
          lead={selectedWhatsAppLead}
          onClose={() => setSelectedWhatsAppLead(null)}
        />
      )}
    </div>
  );
}
