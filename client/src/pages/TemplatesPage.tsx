import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  type: string;
  filename: string;
  createdAt: string;
}

const PLACEHOLDER_GROUPS = [
  {
    group: 'Job',
    items: [
      { tag: '{job_id}', description: 'Job ID (e.g. J-0124)' },
      { tag: '{status}', description: 'Job status' },
      { tag: '{priority}', description: 'Priority level' },
      { tag: '{created_date}', description: 'Date job was created' },
      { tag: '{scheduled_date}', description: 'Scheduled service date' },
      { tag: '{description}', description: 'Job description' },
      { tag: '{damage_type}', description: 'Type of damage / work' },
      { tag: '{notes}', description: 'Additional notes' },
      { tag: '{estimated_price}', description: 'Estimated price' },
    ],
  },
  {
    group: 'Customer',
    items: [
      { tag: '{customer_name}', description: 'Customer full name' },
      { tag: '{customer_email}', description: 'Customer email' },
      { tag: '{customer_phone}', description: 'Customer phone' },
      { tag: '{customer_address}', description: 'Customer address' },
      { tag: '{customer_tax_number}', description: 'Customer tax number' },
    ],
  },
  {
    group: 'Vehicle',
    items: [
      { tag: '{vehicle_make}', description: 'Make (e.g. BMW)' },
      { tag: '{vehicle_model}', description: 'Model (e.g. 320d)' },
      { tag: '{vehicle_year}', description: 'Year' },
      { tag: '{vehicle_plate}', description: 'License plate' },
      { tag: '{vehicle_vin}', description: 'VIN number' },
      { tag: '{vehicle_color}', description: 'Color' },
      { tag: '{vehicle_mileage}', description: 'Mileage (km)' },
    ],
  },
  {
    group: 'Items loop (products & services)',
    items: [
      { tag: '{#items}', description: 'Start of items loop — place before first column' },
      { tag: '{item_name}', description: 'Product/service name' },
      { tag: '{item_type}', description: 'Product or Service' },
      { tag: '{item_qty}', description: 'Quantity or hours' },
      { tag: '{item_unit}', description: 'Unit (pc, hr, set…)' },
      { tag: '{item_unit_price}', description: 'Unit price' },
      { tag: '{item_vat_pct}', description: 'VAT percentage' },
      { tag: '{item_total_net}', description: 'Line total (net)' },
      { tag: '{item_total_gross}', description: 'Line total (gross)' },
      { tag: '{/items}', description: 'End of items loop — place after last column' },
    ],
  },
  {
    group: 'Totals',
    items: [
      { tag: '{subtotal}', description: 'Sum of all net totals' },
      { tag: '{vat_total}', description: 'Total VAT amount' },
      { tag: '{grand_total}', description: 'Grand total (gross)' },
    ],
  },
  {
    group: 'Company',
    items: [
      { tag: '{company_name}', description: 'Your company name' },
      { tag: '{company_address}', description: 'Your company address' },
      { tag: '{company_tax_number}', description: 'Your tax number' },
      { tag: '{company_phone}', description: 'Your phone number' },
    ],
  },
];


export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    api.get<Template[]>('/documents').then(setTemplates).catch(console.error);
  }, []);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState('offer');
  const [uploading, setUploading] = useState(false);
  const [copiedTag, setCopiedTag] = useState('');
  const [showRef, setShowRef] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 1500);
  };

  const downloadStarter = () => {
    window.open('/api/documents/starter', '_blank');
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadName) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', uploadName);
      fd.append('type', uploadType);
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const tmpl = await res.json();
      setTemplates((prev) => [tmpl, ...prev]);
      setUploadName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    await api.delete(`/documents/${id}`).catch(console.error);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Document Templates</h2>
        <p className="text-gray-500 mt-1">Manage .docx templates for offers and deviz</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Upload + templates list */}
        <div className="space-y-4">
          {/* Starter download */}
          <div className="card p-5 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-1">New to templates?</h3>
            <p className="text-blue-700 text-sm mb-3">Download the starter template. Open in Word, customize design, keep the placeholders, re-upload.</p>
            <button onClick={downloadStarter} className="btn-primary text-sm">
              ↓ Download Starter Template
            </button>
          </div>

          {/* Upload */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Upload Template</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Template Name</label>
                <input className="input" placeholder="e.g. Standard Offer 2026" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select className="input" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                  <option value="offer">Offer</option>
                  <option value="deviz">Deviz / Estimate</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">File (.docx only)</label>
                <input ref={fileRef} type="file" accept=".docx" className="input py-1.5" />
              </div>
              <button onClick={handleUpload} disabled={uploading || !uploadName} className="btn-primary w-full justify-center">
                {uploading ? 'Uploading...' : 'Upload Template'}
              </button>
            </div>
          </div>

          {/* Templates list */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Saved Templates</h3>
            </div>
            {templates.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No templates yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.type} · {t.filename} · {t.createdAt}</p>
                    </div>
                    <button onClick={() => deleteTemplate(t.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Placeholder reference */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowRef((v) => !v)}
            className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900">Placeholder Reference</h3>
            <span className="text-gray-400 text-sm">{showRef ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {showRef && (
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {PLACEHOLDER_GROUPS.map((group) => (
                <div key={group.group} className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.group}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div key={item.tag} className="flex items-center justify-between gap-2 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs bg-gray-100 text-blue-700 px-2 py-0.5 rounded font-mono whitespace-nowrap">{item.tag}</code>
                          <span className="text-xs text-gray-500 truncate">{item.description}</span>
                        </div>
                        <button
                          onClick={() => copyTag(item.tag)}
                          className="text-xs text-gray-400 hover:text-blue-600 whitespace-nowrap shrink-0"
                        >
                          {copiedTag === item.tag ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
