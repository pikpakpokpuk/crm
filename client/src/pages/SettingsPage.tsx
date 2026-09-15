import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type WAStatus = 'initializing' | 'qr' | 'connected' | 'disconnected';

function WhatsAppSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [status, setStatus] = useState<WAStatus>('initializing');
  const [qr, setQr] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const poll = () => {
      api.get<{ status: string; qr?: string }>('/whatsapp/status')
        .then((r) => {
          setStatus(r.status as WAStatus);
          setQr(r.qr ?? null);
        }).catch(console.error);
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    try { await api.delete('/whatsapp/session'); }
    catch (err) { console.error(err); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-1">WhatsApp</h3>
      <p className="text-gray-500 text-sm mb-4">
        One WhatsApp account is shared across the whole CRM.
        {!isAdmin && ' Only admins can link or disconnect it.'}
      </p>
      <div className="flex items-center gap-3 mb-4">
        <span className={`badge ${
          status === 'connected' ? 'bg-green-100 text-green-700' :
          status === 'qr' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {status === 'connected' ? '● Connected' : status === 'qr' ? 'Waiting for scan' : status}
        </span>
        {isAdmin && status === 'connected' && (
          <button className="btn btn-secondary text-sm" onClick={disconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>
      {!isAdmin ? (
        status === 'qr' ? (
          <p className="text-sm text-gray-500">Waiting for an admin to link an account.</p>
        ) : null
      ) : (
        <>
          {status === 'qr' && qr && (
            <div className="flex flex-col items-center gap-2 py-2">
              <img src={qr} alt="WhatsApp QR" className="w-56 h-56 rounded-lg border border-gray-200" />
              <p className="text-xs text-gray-500">Scan with WhatsApp → Linked Devices → Link a Device</p>
            </div>
          )}
          {status === 'initializing' && (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Starting WhatsApp…
            </div>
          )}
          {status === 'disconnected' && (
            <p className="text-sm text-gray-500">WhatsApp disconnected. Restart the server to reconnect.</p>
          )}
        </>
      )}
    </div>
  );
}

interface SheetsConfig { connected: boolean; sheetId: string | null }
type SheetsEntity = 'jobs' | 'employees' | 'customers' | 'inventory';
const SHEETS_ENTITIES: { key: SheetsEntity; label: string }[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'employees', label: 'Employees' },
  { key: 'customers', label: 'Customers' },
  { key: 'inventory', label: 'Inventory' },
];

function GoogleSheetsSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [config, setConfig] = useState<SheetsConfig | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [json, setJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ entity: string; text: string; errors?: { row: number; message: string }[] } | null>(null);

  const load = () => api.get<SheetsConfig>('/integrations/google-sheets/config').then(setConfig).catch(console.error);
  useEffect(() => { load(); }, []);

  const serviceAccountEmail = (() => {
    try { return JSON.parse(json).client_email as string | undefined; } catch { return undefined; }
  })();

  const connect = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.put('/integrations/google-sheets/config', { sheetId: sheetId.trim(), serviceAccountJson: json.trim() });
      setJson('');
      load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const runExport = async (entity: SheetsEntity) => {
    setBusy(`export-${entity}`);
    setResult(null);
    try {
      const r = await api.post<{ exported: number }>(`/integrations/google-sheets/export/${entity}`, {});
      setResult({ entity, text: `Exported ${r.exported} rows.` });
    } catch (err: unknown) {
      setResult({ entity, text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (entity: SheetsEntity) => {
    setBusy(`import-${entity}`);
    setResult(null);
    try {
      const r = await api.post<{ created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }>(`/integrations/google-sheets/import/${entity}`, {});
      setResult({ entity, text: `${r.created} created, ${r.updated} updated, ${r.skipped} skipped.`, errors: r.errors });
    } catch (err: unknown) {
      setResult({ entity, text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Google Sheets</h3>
        <p className="text-gray-500 text-sm">
          {config?.connected ? 'Connected. ' : 'Not connected. '}Only admins can manage this integration.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Google Sheets</h3>
      <p className="text-gray-500 text-sm mb-4">Import/export Jobs, Employees, Customers, and Inventory via a shared Google Sheet.</p>

      {!config?.connected ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sheet ID</label>
            <input className="input" value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="from the sheet's URL" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Account JSON</label>
            <textarea className="input resize-none font-mono text-xs" rows={5} value={json} onChange={(e) => setJson(e.target.value)} placeholder="paste the service account key JSON here" />
          </div>
          {serviceAccountEmail && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              Share your sheet with <span className="font-mono">{serviceAccountEmail}</span> as Editor before connecting.
            </p>
          )}
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <button className="btn btn-primary text-sm" onClick={connect} disabled={saving || !sheetId.trim() || !json.trim()}>
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="badge bg-green-100 text-green-700">● Connected</span>
            <span className="text-xs text-gray-400 font-mono">{config.sheetId}</span>
          </div>
          <div className="space-y-2">
            {SHEETS_ENTITIES.map((e) => (
              <div key={e.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-800">{e.label}</span>
                <div className="flex gap-2">
                  <button className="btn btn-secondary text-xs px-2 py-1" disabled={!!busy} onClick={() => runExport(e.key)}>
                    {busy === `export-${e.key}` ? 'Exporting...' : 'Export'}
                  </button>
                  <button className="btn btn-secondary text-xs px-2 py-1" disabled={!!busy} onClick={() => runImport(e.key)}>
                    {busy === `import-${e.key}` ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {result && (
            <div className="text-sm bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-medium text-gray-800">{SHEETS_ENTITIES.find((e) => e.key === result.entity)?.label}: {result.text}</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 mt-1">Configure CRM behavior</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Custom Fields */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Custom Fields</h3>
          <p className="text-gray-500 text-sm mb-4">Add extra fields to jobs, customers, or vehicles.</p>
          <div className="space-y-2">
            {[
              { name: 'Insurance Company', entity: 'Job', type: 'text' },
              { name: 'Fleet Number', entity: 'Vehicle', type: 'text' },
            ].map((field) => (
              <div key={field.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{field.name}</p>
                  <p className="text-xs text-gray-500">{field.entity} · {field.type}</p>
                </div>
                <button className="btn-secondary text-xs px-2 py-1">Edit</button>
              </div>
            ))}
          </div>
          <button className="btn-secondary mt-3 text-sm">+ Add Custom Field</button>
        </div>

        {/* Workflow Automation */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Workflow Automation</h3>
          <p className="text-gray-500 text-sm mb-4">Triggers that run when job status changes.</p>
          <div className="space-y-2">
            {[
              { trigger: 'Job → Ready', action: 'Send SMS to customer', active: true },
              { trigger: 'Job → In Progress', action: 'Notify assigned employee', active: true },
              { trigger: 'Job → Delivered', action: 'Generate invoice PDF', active: false },
            ].map((rule) => (
              <div key={rule.trigger} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{rule.trigger}</p>
                  <p className="text-xs text-gray-500">{rule.action}</p>
                </div>
                <span className={`badge ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {rule.active ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
          </div>
          <button className="btn-secondary mt-3 text-sm">+ Add Rule</button>
        </div>

        <WhatsAppSection />
        <GoogleSheetsSection />

        {/* Company Info */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Company Info</h3>
          <div className="space-y-3">
            {[
              { label: 'Company Name', value: 'Garage Kft.' },
              { label: 'Tax Number', value: '12345678-2-01' },
              { label: 'Address', value: 'Budapest, Műhely utca 1' },
              { label: 'Phone', value: '+36 1 123 4567' },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                <input className="input" defaultValue={field.value} />
              </div>
            ))}
            <button className="btn-primary mt-2">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
