'use client';

import React, { useState, useEffect } from 'react';
import { Search, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export function PhoneChecker() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    checked: boolean;
    exists: boolean;
    lead?: {
      name: string;
      nicho: string;
      stage: string;
      phone: string;
    };
  } | null>(null);

  useEffect(() => {
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      setResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(cleanDigits)}`);
        const data = await res.json();
        setResult({
          checked: true,
          exists: Boolean(data.exists),
          lead: data.lead,
        });
      } catch (err) {
        console.error('Phone lookup failed', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [phone]);

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Checar telefone rápido (DDD + número)..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 className="absolute right-3 w-4 h-4 text-blue-500 animate-spin" />
        ) : phone ? (
          <button
            onClick={() => {
              setPhone('');
              setResult(null);
            }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {result && result.checked && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs animate-in fade-in slide-in-from-top-1">
          {result.exists && result.lead ? (
            <div className="flex items-start gap-2.5 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">
                  Lead já cadastrado: <span className="text-blue-600">{result.lead.name}</span>
                </p>
                <p className="text-slate-500 mt-0.5">
                  Nicho: <span className="font-medium text-slate-700">{result.lead.nicho}</span> • Estágio atual:{' '}
                  <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                    {result.lead.stage}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-medium">
                Número livre! <span className="text-slate-500 font-normal">Nenhum lead com este telefone encontrado.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
