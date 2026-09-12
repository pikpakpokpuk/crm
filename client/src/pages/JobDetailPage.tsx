import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { JobStatus, Priority } from '@/types';

// API returns camelCase with uppercase enums
interface StatusHistoryEntry {
  id: string;
  status: string;
  changedAt: string;
  changedBy: string | null;
  note: string | null;
}

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
  assignedTo: { id: string; name: string; email: string } | null;
  statusHistory: StatusHistoryEntry[];
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehiclePlate: string | null;
  vehicleVin: string | null;
  vehicleColor: string | null;
  vehicleMileage: number | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

interface WAMessage {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: string;
  customerPhone: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'whatsapp'>('overview');

  // log tab
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // whatsapp tab
  const [waMessages, setWaMessages] = useState<WAMessage[]>([]);
  const [waStatus, setWaStatus] = useState<'initializing' | 'qr' | 'connected' | 'disconnected'>('initializing');
  const [waInput, setWaInput] = useState('');
  const [waSending, setWaSending] = useState(false);
  const waChatRef = useRef<HTMLDivElement>(null);

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
  // vehicle form state
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');

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
      setVehicleMake(j.vehicleMake ?? '');
      setVehicleModel(j.vehicleModel ?? '');
      setVehicleYear(j.vehicleYear ? String(j.vehicleYear) : '');
      setVehiclePlate(j.vehiclePlate ?? '');
      setVehicleVin(j.vehicleVin ?? '');
      setVehicleColor(j.vehicleColor ?? '');
      setVehicleMileage(j.vehicleMileage ? String(j.vehicleMileage) : '');

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

  // Load activity log when tab is opened
  useEffect(() => {
    if (activeTab !== 'log' || !id) return;
    setLogLoading(true);
    api.get<ActivityEntry[]>(`/jobs/${id}/activity`)
      .then(setActivityLog).catch(console.error).finally(() => setLogLoading(false));
  }, [activeTab, id]);

  // WhatsApp: sync history + poll status + messages when tab open
  useEffect(() => {
    if (activeTab !== 'whatsapp' || !id || !job) return;
    const phone = encodeURIComponent(job.customer.phone);
    // Sync chat history from WA on tab open
    api.get(`/whatsapp/sync?phone=${phone}`).catch(console.error);
    const poll = () => {
      api.get<{ status: string }>('/whatsapp/status').then((r) => setWaStatus(r.status as WAStatus)).catch(console.error);
      api.get<WAMessage[]>(`/whatsapp/messages?phone=${phone}`)
        .then((msgs) => {
          setWaMessages(msgs);
          setTimeout(() => waChatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        }).catch(console.error);
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, [activeTab, id, job]);

  type WAStatus = 'initializing' | 'qr' | 'connected' | 'disconnected';

  const sendWA = async () => {
    if (!waInput.trim() || !job || waSending) return;
    setWaSending(true);
    try {
      await api.post('/whatsapp/send', { phone: job.customer.phone, body: waInput.trim(), jobId: id });
      setWaInput('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Send failed');
    } finally { setWaSending(false); }
  };

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
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleYear: vehicleYear ? parseInt(vehicleYear) : null,
        vehiclePlate: vehiclePlate || null,
        vehicleVin: vehicleVin || null,
        vehicleColor: vehicleColor || null,
        vehicleMileage: vehicleMileage ? parseInt(vehicleMileage) : null,
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
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear,
        vehicle_plate: vehiclePlate,
        vehicle_vin: vehicleVin,
        vehicle_color: vehicleColor,
        vehicle_mileage: vehicleMileage,
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

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['overview', 'log', 'whatsapp'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'log' ? 'Activity Log' : 'WhatsApp'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (<>
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

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Vehicle</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make">
                <input className="input py-1 text-sm" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="BMW" />
              </Field>
              <Field label="Model">
                <input className="input py-1 text-sm" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="320d" />
              </Field>
              <Field label="Year">
                <input className="input py-1 text-sm" type="number" min="1990" max="2030" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="2022" />
              </Field>
              <Field label="Plate">
                <input className="input py-1 text-sm" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="ABC-123" />
              </Field>
              <Field label="Color">
                <input className="input py-1 text-sm" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="White" />
              </Field>
              <Field label="Mileage (km)">
                <input className="input py-1 text-sm" type="number" min="0" value={vehicleMileage} onChange={(e) => setVehicleMileage(e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="VIN">
                  <input className="input py-1 text-sm font-mono" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} placeholder="WBA3A5C5XDF123456" />
                </Field>
              </div>
            </div>
          </div>
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

      {/* Status History */}
      {job.statusHistory && job.statusHistory.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Status History</h3>
          <ol className="relative border-l border-gray-200 ml-2 space-y-4">
            {job.statusHistory.map((entry) => {
              const empName = employees.find((e) => e.id === entry.changedBy)?.name ?? entry.changedBy ?? 'System';
              const label = entry.status.toLowerCase().replace(/_/g, ' ');
              return (
                <li key={entry.id} className="ml-5">
                  <span className="absolute -left-2 mt-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-400" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge text-xs ${STATUS_COLORS[toLowerStatus(entry.status)] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
                    <span className="text-xs text-gray-400">{new Date(entry.changedAt).toLocaleString()}</span>
                    <span className="text-xs text-gray-500">by {empName}</span>
                  </div>
                  {entry.note && <p className="text-xs text-gray-500 mt-1">{entry.note}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      </>)} {/* end overview tab */}

      {/* Activity Log Tab */}
      {activeTab === 'log' && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-5">Activity Log</h3>
          {logLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activityLog.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No activity recorded yet.</p>
          ) : (
            <ol className="relative border-l border-gray-200 ml-2 space-y-5">
              {activityLog.map((entry) => {
                const actionLabel = entry.action.replace(/_/g, ' ');
                const dotColor =
                  entry.action === 'STATUS_CHANGED' ? 'bg-blue-500' :
                  entry.action === 'JOB_CREATED' ? 'bg-green-500' :
                  entry.action === 'LINE_ITEMS_UPDATED' ? 'bg-purple-500' : 'bg-gray-400';
                return (
                  <li key={entry.id} className="ml-5">
                    <span className={`absolute -left-2 mt-1 w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor}`} />
                    <p className="text-sm font-medium text-gray-800">{actionLabel}</p>
                    {entry.details && <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(entry.createdAt).toLocaleString()}{entry.user ? ` · ${entry.user.name}` : ''}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div className="card flex flex-col" style={{ height: '600px' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-lg">💬</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{job.customer.name}</p>
                <p className="text-xs text-gray-400">{job.customer.phone}</p>
              </div>
            </div>
            <span className={`badge text-xs ${
              waStatus === 'connected' ? 'bg-green-100 text-green-700' :
              waStatus === 'qr' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {waStatus === 'connected' ? '● Connected' : waStatus === 'qr' ? 'Scan QR in Settings' : waStatus}
            </span>
          </div>

          {waStatus !== 'connected' ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm flex-col gap-2">
              <span>WhatsApp not connected.</span>
              <span>Go to Settings → WhatsApp to scan QR code.</span>
            </div>
          ) : (
            <>
              <div ref={waChatRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {waMessages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No messages yet.</p>
                )}
                {waMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                      msg.fromMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}>
                      <p>{msg.body}</p>
                      <p className={`text-xs mt-1 ${msg.fromMe ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                <input
                  className="input flex-1"
                  placeholder="Type a message…"
                  value={waInput}
                  onChange={(e) => setWaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendWA(); }}}
                  disabled={waSending}
                />
                <button
                  className="btn btn-primary shrink-0"
                  onClick={sendWA}
                  disabled={waSending || !waInput.trim()}
                >
                  {waSending ? '…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
