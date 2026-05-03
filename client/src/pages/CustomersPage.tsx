import { useState } from 'react';
import type { Customer } from '@/types';

const MOCK_CUSTOMERS: Customer[] = [
  { id: '1', name: 'Kovács István', email: 'kovacs@email.hu', phone: '+36 30 123 4567', address: 'Budapest, Fő utca 12', created_at: '2026-01-15' },
  { id: '2', name: 'Nagy Péter', email: 'nagy@email.hu', phone: '+36 20 987 6543', address: 'Debrecen, Kossuth tér 3', created_at: '2026-02-03' },
  { id: '3', name: 'Szabó Anna', email: 'szabo@email.hu', phone: '+36 70 555 0000', address: 'Győr, Baross út 45', created_at: '2026-03-22' },
  { id: '4', name: 'Tóth Gábor', email: 'toth@email.hu', phone: '+36 30 111 2222', address: 'Pécs, Rákóczi út 7', created_at: '2026-04-01' },
  { id: '5', name: 'Horváth Béla', email: 'horvath@email.hu', phone: '+36 20 333 4444', address: 'Miskolc, Széchenyi tér 2', created_at: '2026-04-18' },
];

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const filtered = MOCK_CUSTOMERS.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 mt-1">{MOCK_CUSTOMERS.length} total</p>
        </div>
        <button className="btn-primary">+ New Customer</button>
      </div>

      <input
        className="input max-w-xs"
        placeholder="Search by name, email, phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-hidden">
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
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3 text-gray-600">{c.email}</td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{c.phone}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{c.address ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{c.created_at}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs px-2 py-1">View</button>
                      <button className="btn-secondary text-xs px-2 py-1">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No customers found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
