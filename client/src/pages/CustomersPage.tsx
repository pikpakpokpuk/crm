import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Customer } from '@/types';

interface CustomersResponse { customers: Customer[]; total: number; }

interface CustomerForm { name: string; phone: string; email: string; address: string; taxNumber: string; notes: string; }
const EMPTY: CustomerForm = { name: '', phone: '', email: '', address: '', taxNumber: '', notes: '' };

function customerToForm(c: Customer): CustomerForm {
  return { name: c.name, phone: c.phone, email: c.email ?? '', address: c.address ?? '', taxNumber: c.taxNumber ?? '', notes: c.notes ?? '' };
}

function CustomerModal({
  mode, customer, onClose, onSaved,
}: { mode: 'add' | 'edit'; customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CustomerForm>(customer ? customerToForm(customer) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (f: keyof CustomerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.phone.trim()) { setError('Phone is required'); return; }
    setError('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (mode === 'add') {
        await api.post('/customers', body);
      } else {
        await api.put(`/customers/${customer!.id}`, body);
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
          <h3 className="text-lg font-semibold text-gray-900">{mode === 'add' ? 'New Customer' : 'Edit Customer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Full name or company" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+36 30 123 4567" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="City, Street..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
            <input className="input" value={form.taxNumber} onChange={set('taxNumber')} placeholder="12345678-1-42" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : mode === 'add' ? 'Create Customer' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'add' } | { type: 'edit'; customer: Customer } | null>(null);

  const loadCustomers = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    setLoading(true);
    api.get<CustomersResponse>(`/customers?${params.toString()}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomers(); }, [search]);

  const customers = data?.customers ?? [];

  return (
    <div className="p-6 space-y-5">
      {modal?.type === 'add' && <CustomerModal mode="add" onClose={() => setModal(null)} onSaved={loadCustomers} />}
      {modal?.type === 'edit' && <CustomerModal mode="edit" customer={modal.customer} onClose={() => setModal(null)} onSaved={loadCustomers} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New Customer
        </button>
      </div>

      <input className="input max-w-xs" placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />

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
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium">Since</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3 text-gray-600">{c.email}</td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{c.phone}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{c.address ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{c.created_at?.slice(0, 10)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary text-xs px-2 py-1" onClick={() => setModal({ type: 'edit', customer: c })}>Edit</button>
                        <button
                          className="btn text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                          onClick={async () => {
                            if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
                            try { await api.delete(`/customers/${c.id}`); loadCustomers(); }
                            catch (err: unknown) { alert(err instanceof Error ? err.message : 'Delete failed — customer may have associated jobs'); }
                          }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && <div className="text-center py-12 text-gray-400">No customers found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
