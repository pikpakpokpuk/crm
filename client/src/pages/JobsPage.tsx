import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Job, JobStatus, Priority, Customer } from '@/types';

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

const ALL_STATUSES: JobStatus[] = ['new', 'in_progress', 'waiting_parts', 'ready', 'delivered', 'cancelled'];

interface JobsResponse { jobs: Job[]; total: number; page: number; pages: number; }
interface EmployeeOption { id: string; name: string; }

interface NewJobForm {
  customerId: string;
  description: string;
  damageType: string;
  priority: string;
  assignedToId: string;
  scheduledAt: string;
  estimatedPrice: string;
  notes: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehiclePlate: string;
  vehicleColor: string;
}

const EMPTY_FORM: NewJobForm = {
  customerId: '', description: '', damageType: '',
  priority: 'MEDIUM', assignedToId: '', scheduledAt: '', estimatedPrice: '', notes: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '', vehiclePlate: '', vehicleColor: '',
};

function NewJobModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NewJobForm>(EMPTY_FORM);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ customers: Customer[] }>('/customers?limit=100').then((r) => setCustomers(r.customers)).catch(console.error);
    api.get<{ employees: EmployeeOption[] }>('/employees?limit=100').then((r) => setEmployees(r.employees)).catch(console.error);
  }, []);

  const set = (field: keyof NewJobForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setError('Customer is required'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/jobs', {
        customerId: form.customerId,
        description: form.description.trim(),
        damageType: form.damageType.trim() || undefined,
        priority: form.priority,
        assignedToId: form.assignedToId || undefined,
        scheduledAt: form.scheduledAt || undefined,
        estimatedPrice: form.estimatedPrice ? parseFloat(form.estimatedPrice) : undefined,
        notes: form.notes.trim() || undefined,
        vehicleMake: form.vehicleMake.trim() || undefined,
        vehicleModel: form.vehicleModel.trim() || undefined,
        vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : undefined,
        vehiclePlate: form.vehiclePlate.trim() || undefined,
        vehicleColor: form.vehicleColor.trim() || undefined,
      });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">New Job</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
            <select className="input" value={form.customerId} onChange={set('customerId')}>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={set('description')} placeholder="What needs to be done..." />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Damage Type</label>
              <input className="input" value={form.damageType} onChange={set('damageType')} placeholder="e.g. Glass, Windowfilm..." />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Vehicle */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Make</label>
                <input className="input" value={form.vehicleMake} onChange={set('vehicleMake')} placeholder="BMW" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Model</label>
                <input className="input" value={form.vehicleModel} onChange={set('vehicleModel')} placeholder="320d" />
              </div>
              <div className="w-20">
                <label className="block text-xs text-gray-600 mb-1">Year</label>
                <input className="input" type="number" min="1990" max="2030" value={form.vehicleYear} onChange={set('vehicleYear')} placeholder="2022" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Plate</label>
                <input className="input" value={form.vehiclePlate} onChange={set('vehiclePlate')} placeholder="ABC-123" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Color</label>
                <input className="input" value={form.vehicleColor} onChange={set('vehicleColor')} placeholder="White" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select className="input" value={form.assignedToId} onChange={set('assignedToId')}>
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
              <input className="input" type="date" value={form.scheduledAt} onChange={set('scheduledAt')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Price</label>
            <input className="input" type="number" step="0.01" min="0" value={form.estimatedPrice} onChange={set('estimatedPrice')} placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Internal notes..." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadJobs = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter.toUpperCase());
    setLoading(true);
    api.get<JobsResponse>(`/jobs?${params.toString()}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); }, [search, statusFilter]);

  const jobs = data?.jobs ?? [];

  return (
    <div className="p-6 space-y-5">
      {showNew && (
        <NewJobModal onClose={() => setShowNew(false)} onSaved={loadJobs} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} total jobs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New Job
        </button>
      </div>

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
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Est. Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-blue-600 font-medium whitespace-nowrap">{job.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{job.customer?.name}</p>
                      <p className="text-gray-500 text-xs">{job.customer?.phone}</p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-600">
                      {job.vehicleMake ? `${job.vehicleMake} ${job.vehicleModel ?? ''} ${job.vehiclePlate ? `(${job.vehiclePlate})` : ''}`.trim() : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{job.description}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${STATUS_COLORS[job.status?.toLowerCase() as JobStatus]}`}>
                        {job.status?.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${PRIORITY_COLORS[job.priority?.toLowerCase() as Priority]}`}>
                        {job.priority?.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                      {job.estimated_price ? `€${job.estimated_price}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div className="text-center py-12 text-gray-400">No jobs found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
