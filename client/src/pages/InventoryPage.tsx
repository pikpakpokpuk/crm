import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';

interface InventoryResponse { items: InventoryItem[]; total: number; }

const CATEGORIES = ['Window', 'Windowfilm', 'Other'];
const UNITS = ['gram', 'piece', 'ml', 'cm²'];

interface FormData { name: string; category: string; quantity: string; unit: string; unit_price: string; notes: string; }
const EMPTY_FORM: FormData = { name: '', category: '', quantity: '0', unit: 'piece', unit_price: '', notes: '' };

function itemToForm(item: InventoryItem): FormData {
  return {
    name: item.name,
    category: item.category ?? '',
    quantity: String(item.quantity),
    unit: item.unit,
    unit_price: String(item.unit_price),
    notes: item.notes ?? '',
  };
}

function ItemModal({
  mode, item, onClose, onSaved,
}: {
  mode: 'add' | 'edit';
  item?: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>(item ? itemToForm(item) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.category) { setError('Category is required'); return; }
    if (!form.unit_price || isNaN(Number(form.unit_price))) { setError('Unit price must be a number'); return; }
    setError('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category,
        quantity: parseInt(form.quantity) || 0,
        unit: form.unit,
        unitPrice: parseFloat(form.unit_price),
        notes: form.notes.trim() || undefined,
      };
      if (mode === 'add') {
        await api.post('/inventory', body);
      } else {
        await api.put(`/inventory/${item!.id}`, body);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">{mode === 'add' ? 'Add Inventory Item' : 'Edit Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Item name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select className="input" value={form.category} onChange={set('category')}>
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input className="input" type="number" min="0" value={form.quantity} onChange={set('quantity')} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select className="input" value={form.unit} onChange={set('unit')}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price <span className="text-red-500">*</span></label>
            <input className="input" type="number" step="0.01" min="0" value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : mode === 'add' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RestockModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [delta, setDelta] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(delta);
    if (isNaN(d) || d === 0) { setError('Enter a non-zero number'); return; }
    if (item.quantity + d < 0) { setError('Result would be negative'); return; }
    setError('');
    setSaving(true);
    try {
      await api.patch(`/inventory/${item.id}/stock`, { delta: d });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Restock — {item.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">Current: <span className="font-semibold">{item.quantity} {item.unit}</span></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change (+add / −remove)</label>
            <input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 50 or -10" autoFocus />
          </div>
          {delta && !isNaN(parseInt(delta)) && (
            <p className="text-sm text-gray-500">New total: <span className="font-semibold">{item.quantity + parseInt(delta)} {item.unit}</span></p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'add' } | { type: 'edit'; item: InventoryItem } | { type: 'restock'; item: InventoryItem } | null>(null);

  const loadCategories = () =>
    api.get<string[]>('/inventory/categories').then(setCategories).catch(console.error);

  useEffect(() => { loadCategories(); }, []);

  const loadItems = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    setLoading(true);
    api.get<InventoryResponse>(`/inventory?${params.toString()}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, [search, categoryFilter]);

  const onSaved = () => { loadItems(); loadCategories(); };
  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-5">
      {modal?.type === 'add' && <ItemModal mode="add" onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'edit' && <ItemModal mode="edit" item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} />}
      {modal?.type === 'restock' && <RestockModal item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} items</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Add Item
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input className="input max-w-xs" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Unit Price</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-5 py-3 font-mono text-gray-500 text-xs">{item.sku ?? '—'}</td>
                    <td className="px-5 py-3">
                      {item.category && <span className="badge bg-gray-100 text-gray-600">{item.category}</span>}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{item.quantity} {item.unit}</td>
                    <td className="px-5 py-3 text-gray-700">€{Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary text-xs px-2 py-1" onClick={() => setModal({ type: 'edit', item })}>Edit</button>
                        <button className="btn btn-secondary text-xs px-2 py-1" onClick={() => setModal({ type: 'restock', item })}>Restock</button>
                        <button
                          className="btn text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                          onClick={async () => {
                            if (!window.confirm(`Delete "${item.name}"?`)) return;
                            try { await api.delete(`/inventory/${item.id}`); onSaved(); }
                            catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed'); }
                          }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="text-center py-12 text-gray-400">No items found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
