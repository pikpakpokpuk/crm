import { useState } from 'react';
import type { Employee } from '@/types';

const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Varga Tibor', email: 'varga@garage.hu', phone: '+36 30 100 0001', role: 'Head Mechanic', active: true },
  { id: '2', name: 'Kiss Zoltán', email: 'kiss@garage.hu', phone: '+36 30 100 0002', role: 'Mechanic', active: true },
  { id: '3', name: 'Fekete Mária', email: 'fekete@garage.hu', phone: '+36 30 100 0003', role: 'Service Advisor', active: true },
  { id: '4', name: 'Balogh Sándor', email: 'balogh@garage.hu', phone: '+36 30 100 0004', role: 'Parts Manager', active: false },
];

export default function EmployeesPage() {
  const [search, setSearch] = useState('');

  const filtered = MOCK_EMPLOYEES.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
          <p className="text-gray-500 mt-1">{MOCK_EMPLOYEES.filter((e) => e.active).length} active</p>
        </div>
        <button className="btn-primary">+ New Employee</button>
      </div>

      <input
        className="input max-w-xs"
        placeholder="Search by name or role..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((emp) => (
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
              {emp.phone && <p>{emp.phone}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary text-xs flex-1 justify-center">View Jobs</button>
              <button className="btn-secondary text-xs flex-1 justify-center">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">No employees found.</div>
      )}
    </div>
  );
}
