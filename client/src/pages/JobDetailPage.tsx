import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { JobStatus, Priority } from '@/types';

// API returns camelCase with uppercase enums
interface JobDetail {
  id: string;
  createdAt: string;
  description: string;
  damageType: string | null;
  priority: string;
  status: string;
  estimatedPrice: string | null;
  finalPrice: string | null;
  notes: string | null;
  scheduledAt: string | null;
  assignedToId: string | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    address: string | null;
    taxNumber: string | null;
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    plate: string;
    vin: string | null;
    color: string | null;
    mileage: number | null;
  } | null;
  assignedTo: { id: string; name: string; email: string } | null;
}

interface LineItem {
  id: string;
  name: string;
  type: string;
  qty: number;
  unit: string;
  unitPrice: number;
  vatPct: number;
}

interface Template { id: string; name: string; }
interface EmployeeOption { id: string; name: string; }

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
const ALL_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function toLowerStatus(s: string): JobStatus { return s.toLowerCase().replace(/ /g, '_') as JobStatus; }
function toLowerPriority(p: string): Priority { return p.toLowerCase() as Priority; }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [generating, setGenerating] = useState(false);

  // form state
  const [status, setStatus] = useState<JobStatus>('new');
  const [originalStatus, setOriginalStatus] = useState<JobStatus>('new');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');
  const [damageType, setDamageType] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const j = await api.get<JobDetail>(`/jobs/${id}`);
      setJob(j);
      const s = toLowerStatus(j.status);
      setStatus(s);
      setOriginalStatus(s);
      setPriority(toLowerPriority(j.priority));
      setDescription(j.description ?? '');
      setDamageType(j.damageType ?? '');
      setAssignedToId(j.assignedToId ?? '');
      setScheduledAt(j.scheduledAt ? j.scheduledAt.slice(0, 10) : '');
      setEstimatedPrice(j.estimatedPrice ? String(j.estimatedPrice) : '');
      setNotes(j.notes ?? '');

      // load line items separately (also returned in job body but use dedicated endpoint)
      const lineItems = await api.get<LineItem[]>(`/jobs/${id}/items`);
      setItems(lineItems.map((i) => ({
        ...i,
        qty: Number(i.qty),
        unitPrice: Number(i.unitPrice),
        vatPct: Number(i.vatPct),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
    api.get<{ employees: EmployeeOption[] }>('/employees?limit=100').then((r) => setEmployees(r.employees)).catch(console.error);
    api.get<Template[]>('/documents').then((ts) => {
      setTemplates(ts);
      if (ts.length > 0) setSelectedTemplate(ts[0].id);
    }).catch(console.error);
  }, [loadJob]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/jobs/${id}`, {
        description,
        damageType: damageType || null,
        priority: priority.toUpperCase(),
        status: status.toUpperCase(),
        assignedToId: assignedToId || null,
        scheduledAt: scheduledAt || null,
        estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : null,
        notes: notes || null,
      });
      if (status !== originalStatus) {
        await api.patch(`/jobs/${id}/status`, { status: status.toUpperCase() });
        setOriginalStatus(status);
      }
      await api.put(`/jobs/${id}/items`, { items });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (itemId: string, field: keyof LineItem, value: string | number) =>
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));

  const addItem = () =>
    setItems((prev) => [...prev, { id: Date.now().toString(), name: '', type: 'service', qty: 1, unit: 'hr', unitPrice: 0, vatPct: 27 }]);

  const removeItem = (itemId: string) =>
    setItems((prev) => prev.filter((i) => i.id !== itemId));

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const vatTotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice * (i.vatPct / 100), 0);
  const grandTotal = subtotal + vatTotal;

  const generateDoc = async () => {
    if (!job || !selectedTemplate) return;
    setGenerating(true);
    try {
      const body = {
        job_id: job.id,
        status, priority,
        created_date: job.createdAt?.slice(0, 10) ?? '',
        scheduled_date: scheduledAt,
        description, damage_type: damageType, notes,
        estimated_price: estimatedPrice,
        customer_name: job.customer.name,
        customer_email: job.customer.email ?? '',
        customer_phone: job.customer.phone,
        customer_address: job.customer.address ?? '',
        customer_tax_number: job.customer.taxNumber ?? '',
        vehicle_make: job.vehicle?.make ?? '',
        vehicle_model: job.vehicle?.model ?? '',
        vehicle_year: String(job.vehicle?.year ?? ''),
        vehicle_plate: job.vehicle?.plate ?? '',
        vehicle_vin: job.vehicle?.vin ?? '',
        vehicle_color: job.vehicle?.color ?? '',
        vehicle_mileage: String(job.vehicle?.mileage ?? ''),
        assigned_to: employees.find((e) => e.id === assignedToId)?.name ?? '',
        items: items.map((i) => ({
          item_name: i.name, item_type: i.type,
          item_qty: String(i.qty), item_unit: i.unit,
          item_unit_price: `€${i.unitPrice.toFixed(2)}`,
          item_vat_pct: `${i.vatPct}%`,
          item_total_net: `€${(i.qty * i.unitPrice).toFixed(2)}`,
          item_total_gross: `€${(i.qty * i.unitPrice * (1 + i.vatPct / 100)).toFixed(2)}`,
        })),
        subtotal: `€${subtotal.toFixed(2)}`,
        vat_total: `€${vatTotal.toFixed(2)}`,
        grand_total: `€${grandTotal.toFixed(2)}`,
        company_name: 'Garage Kft.',
        company_address: 'Budapest, Műhely utca 1',
        company_tax_number: '12345678-2-01',
        company_phone: '+36 1 123 4567',
      };
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${selectedTemplate}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-${job.id.slice(0, 8)}-document.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return <div className="p-6 text-gray-500">Job not found.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/jobs')} className="text-gray-400 hover:text-gray-600 text-sm">← Jobs</button>
          <h2 className="text-2xl font-bold text-gray-900 font-mono">{job.id.slice(0, 8)}</h2>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
            className={`badge border-0 cursor-pointer font-medium ${STATUS_COLORS[status]}`}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className={`badge border-0 cursor-pointer font-medium ${PRIORITY_COLORS[priority]}`}
          >
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-gray-400 text-sm">Created {job.createdAt?.slice(0, 10)}</span>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap items-center">
          {templates.length > 0 && (
            <div className="flex gap-1">
              <select
                className="input py-1 text-sm w-auto"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary text-sm"
                disabled={generating || !selectedTemplate}
                onClick={generateDoc}
              >
                {generating ? 'Generating...' : '↓ Generate'}
              </button>
            </div>
          )}
          {saveError && <span className="text-red-600 text-xs">{saveError}</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Customer + Vehicle */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Customer</h3>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-gray-900 text-base">{job.customer.name}</p>
              <div className="space-y-1 text-gray-600 mt-2">
                <p>📞 {job.customer.phone}</p>
                {job.customer.email && <p>✉️ {job.customer.email}</p>}
                {job.customer.address && <p>📍 {job.customer.address}</p>}
                {job.customer.taxNumber && <p>🧾 {job.customer.taxNumber}</p>}
              </div>
            </div>
          </div>

          {job.vehicle && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Vehicle</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Make', value: job.vehicle.make },
                  { label: 'Model', value: job.vehicle.model },
                  { label: 'Year', value: String(job.vehicle.year) },
                  { label: 'Plate', value: job.vehicle.plate },
                  job.vehicle.color ? { label: 'Color', value: job.vehicle.color } : null,
                  job.vehicle.mileage ? { label: 'Mileage', value: `${job.vehicle.mileage.toLocaleString()} km` } : null,
                ].filter(Boolean).map((f) => (
                  <div key={f!.label}>
                    <p className="text-xs text-gray-400">{f!.label}</p>
                    <p className="font-medium text-gray-800">{f!.value}</p>
                  </div>
                ))}
                {job.vehicle.vin && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">VIN</p>
                    <p className="font-mono text-xs text-gray-700">{job.vehicle.vin}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Job Details */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Job Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Description">
              <textarea className="input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            <Field label="Notes">
              <textarea className="input resize-none" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <Field label="Damage / Work Type">
              <input className="input" value={damageType} onChange={(e) => setDamageType(e.target.value)} />
            </Field>

            <Field label="Assigned To">
              <select className="input" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Scheduled Date">
              <input type="date" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>

            <Field label="Estimated Price (€)">
              <input type="number" step="0.01" className="input" value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)} />
            </Field>

            <Field label="Status">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Products & Services Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Products & Services</h3>
          <button onClick={addItem} className="btn btn-secondary text-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 font-medium w-8">#</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-28">Type</th>
                <th className="px-4 py-3 font-medium w-20">Qty</th>
                <th className="px-4 py-3 font-medium w-20">Unit</th>
                <th className="px-4 py-3 font-medium w-28">Unit Price (€)</th>
                <th className="px-4 py-3 font-medium w-20">VAT %</th>
                <th className="px-4 py-3 font-medium w-28 text-right">Net</th>
                <th className="px-4 py-3 font-medium w-28 text-right">Gross</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => {
                const net = item.qty * item.unitPrice;
                const gross = net * (1 + item.vatPct / 100);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <input className="input py-1" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} placeholder="Item name" />
                    </td>
                    <td className="px-4 py-2">
                      <select className="input py-1" value={item.type} onChange={(e) => updateItem(item.id, 'type', e.target.value)}>
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" className="input py-1" value={item.qty} min={0} onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-4 py-2">
                      <input className="input py-1" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" className="input py-1" value={item.unitPrice} min={0} onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" className="input py-1" value={item.vatPct} min={0} max={100} onChange={(e) => updateItem(item.id, 'vatPct', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">€{net.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">€{gross.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No items yet. Click Add Row.</div>}
        </div>

        <div className="border-t border-gray-100 p-5 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal (net)</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT</span>
              <span>€{vatTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
              <span>Total (gross)</span>
              <span>€{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
