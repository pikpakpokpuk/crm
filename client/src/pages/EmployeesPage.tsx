import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  _count?: { assignedJobs: number };
}

interface EmployeesResponse { employees: Employee[]; total: number; }

interface NewEmployeeForm { name: string; email: string; password: string; role: string; }
const EMPTY: NewEmployeeForm = { name: '', email: '', password: '', role: 'EMPLOYEE' };

function NewEmployeeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NewEmployeeForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (f: keyof NewEmployeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.password || form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/employees', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">New Employee</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="employee@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<EmployeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadEmployees = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    setLoading(true);
    api.get<EmployeesResponse>(`/employees?${params.toString()}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, [search]);

  const employees = data?.employees ?? [];

  return (
    <div className="p-6 space-y-5">
      {showNew && <NewEmployeeModal onClose={() => setShowNew(false)} onSaved={loadEmployees} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-gray-500 mt-1">{employees.filter((e) => e.active).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New Employee
        </button>
      </div>

      <input className="input max-w-xs" placeholder="Search by name or role..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${emp.active ? 'bg-blue-600' : 'bg-gray-400'}`}>
                    {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{emp.name}</p>
                    <p className="text-gray-500 text-sm">{emp.role}</p>
                  </div>
                </div>
                <span className={`badge ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {emp.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <p>{emp.email}</p>
                {emp._count && <p className="text-gray-400 text-xs">{emp._count.assignedJobs} assigned jobs</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-secondary text-xs flex-1 justify-center">View Jobs</button>
                <button className="btn-secondary text-xs flex-1 justify-center">Edit</button>
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">No employees found.</div>
          )}
        </div>
      )}
    </div>
  );
}
