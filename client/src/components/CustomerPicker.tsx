import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface Match { id: string; name: string; phone: string }

// Either an existing customer was chosen, or free text will become a new customer.
export type CustomerChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string; phone: string }
  | { kind: 'none' };

export default function CustomerPicker({ value, onChange }: { value: CustomerChoice; onChange: (v: CustomerChoice) => void }) {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searchFailed, setSearchFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Server-side search (debounced), so it works with any number of customers.
  useEffect(() => {
    if (!open || value.kind === 'existing') return;
    let ignore = false; // drop responses that arrive after the text has changed
    const t = setTimeout(() => {
      api.get<{ customers: Match[] }>(`/customers?limit=8&search=${encodeURIComponent(text.trim())}`)
        .then((r) => { if (!ignore) { setMatches(r.customers); setActive(-1); setSearchFailed(false); } })
        .catch(() => { if (!ignore) setSearchFailed(true); });
    }, 200);
    return () => { ignore = true; clearTimeout(t); };
  }, [text, open, value.kind]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (m: Match) => {
    onChange({ kind: 'existing', id: m.id, name: m.name });
    setText(m.name);
    setOpen(false);
  };

  const type = (v: string) => {
    setText(v);
    setOpen(true);
    onChange(v.trim() ? { kind: 'new', name: v.trim(), phone: value.kind === 'new' ? value.phone : '' } : { kind: 'none' });
  };

  const clear = () => { setText(''); setMatches([]); onChange({ kind: 'none' }); setOpen(true); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const listShowing = open && value.kind !== 'existing' && matches.length > 0;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.min(Math.max(i - 1, 0), matches.length - 1)); }
    else if (e.key === 'Enter' && listShowing) { e.preventDefault(); if (matches[active]) choose(matches[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <input
          className="input pr-8"
          value={text}
          placeholder="Search customers, or type a new name..."
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {text && (
          <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="Clear customer">&times;</button>
        )}
      </div>

      {open && value.kind !== 'existing' && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {matches.map((m, i) => (
            <li
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); choose(m); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${i === active ? 'bg-blue-50' : ''}`}
            >
              <span className="font-medium text-gray-900">{m.name}</span>
              {m.phone && <span className="text-gray-500"> — {m.phone}</span>}
            </li>
          ))}
        </ul>
      )}

      {searchFailed && open && <p className="text-xs text-red-600 mt-1">Couldn't search customers. Check your connection.</p>}

      {value.kind === 'existing' && <p className="text-xs text-green-700 mt-1">Existing customer selected.</p>}

      {value.kind === 'new' && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <p className="text-xs text-blue-800">
            No customer picked. A <b>new customer "{value.name}"</b> will be created with this job.
          </p>
          <input
            className="input"
            value={value.phone}
            placeholder="Phone (optional, can be added later)"
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
