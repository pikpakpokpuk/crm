import { useState } from 'react';
import type { Job, JobStatus, Priority } from '@/types';

const STATUS_COLORS: Record<JobStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_parts: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-700',
};

const MOCK_JOBS: Job[] = [
  {
    id: 'J-0124', created_at: '2026-04-29', created_by: '1',
    customer_id: '1', description: 'Front bumper replacement',
    damage_type: 'Collision', priority: 'high', status: 'in_progress',
    estimated_price: 450, final_price: undefined,
    customer: { id: '1', name: 'Kovács István', email: 'kovacs@email.hu', phone: '+36 30 123 4567', created_at: '2026-01-01' },
    vehicle: { id: '1', customer_id: '1', make: 'BMW', model: '320d', year: 2019, plate: 'ABC-123' },
  },
  {
    id: 'J-0123', created_at: '2026-04-28', created_by: '1',
    customer_id: '2', description: 'Engine oil leak repair',
    damage_type: 'Mechanical', priority: 'medium', status: 'waiting_parts',
    estimated_price: 280,
    customer: { id: '2', name: 'Nagy Péter', email: 'nagy@email.hu', phone: '+36 20 987 6543', created_at: '2026-02-01' },
    vehicle: { id: '2', customer_id: '2', make: 'VW', model: 'Golf', year: 2021, plate: 'XYZ-789' },
  },
  {
    id: 'J-0122', created_at: '2026-04-27', created_by: '1',
    customer_id: '3', description: 'Full service + tire change',
    damage_type: 'Service', priority: 'low', status: 'ready',
    estimated_price: 180, final_price: 195,
    customer: { id: '3', name: 'Szabó Anna', email: 'szabo@email.hu', phone: '+36 70 555 0000', created_at: '2026-03-01' },
    vehicle: { id: '3', customer_id: '3', make: 'Opel', model: 'Astra', year: 2018, plate: 'DEF-456' },
  },
  {
    id: 'J-0121', created_at: '2026-04-29', created_by: '1',
    customer_id: '4', description: 'Brake system overhaul',
    damage_type: 'Safety', priority: 'urgent', status: 'new',
    estimated_price: 620,
    customer: { id: '4', name: 'Tóth Gábor', email: 'toth@email.hu', phone: '+36 30 111 2222', created_at: '2026-04-01' },
    vehicle: { id: '4', customer_id: '4', make: 'Ford', model: 'Focus', year: 2020, plate: 'GHI-012' },
  },
];

const ALL_STATUSES: JobStatus[] = ['new', 'in_progress', 'waiting_parts', 'ready', 'delivered', 'cancelled'];

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');

  const filtered = MOCK_JOBS.filter((job) => {
    const matchSearch =
      !search ||
      job.id.toLowerCase().includes(search.toLowerCase()) ||
      job.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || job.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-gray-500 mt-1">{MOCK_JOBS.length} total jobs</p>
        </div>
        <button className="btn-primary">+ New Job</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | '')}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Est. Price</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-blue-600 font-medium whitespace-nowrap">{job.id}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{job.customer?.name}</p>
                    <p className="text-gray-500 text-xs">{job.customer?.phone}</p>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-gray-600">
                    {job.vehicle ? `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.plate})` : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{job.description}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${STATUS_COLORS[job.status]}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${PRIORITY_COLORS[job.priority]}`}>
                      {job.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                    {job.estimated_price ? `€${job.estimated_price}` : '—'}
                  </td>
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
            <div className="text-center py-12 text-gray-400">No jobs match your filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
