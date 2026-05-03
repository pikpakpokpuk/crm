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
