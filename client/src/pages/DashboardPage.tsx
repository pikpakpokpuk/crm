import { useAuth } from '@/contexts/AuthContext';

const STATS = [
  { label: 'Active Jobs', value: '24', change: '+3 today', color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Customers', value: '148', change: '+1 this week', color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Ready for Pickup', value: '7', change: '2 overdue', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { label: 'Revenue (month)', value: '€12,400', change: '+8% vs last', color: 'text-purple-600', bg: 'bg-purple-50' },
];

const RECENT_JOBS = [
  { id: 'J-0124', customer: 'Kovács István', vehicle: 'BMW 320d', status: 'in_progress', priority: 'high' },
  { id: 'J-0123', customer: 'Nagy Péter', vehicle: 'VW Golf', status: 'waiting_parts', priority: 'medium' },
  { id: 'J-0122', customer: 'Szabó Anna', vehicle: 'Opel Astra', status: 'ready', priority: 'low' },
  { id: 'J-0121', customer: 'Tóth Gábor', vehicle: 'Ford Focus', status: 'new', priority: 'urgent' },
  { id: 'J-0120', customer: 'Horváth Béla', vehicle: 'Toyota Corolla', status: 'delivered', priority: 'medium' },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_parts: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
              <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-gray-900 font-semibold">{stat.label}</p>
            <p className="text-gray-500 text-sm mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Jobs</h3>
          <a href="/jobs" className="text-blue-600 text-sm hover:underline">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Job ID</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {RECENT_JOBS.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-blue-600 font-medium">{job.id}</td>
                  <td className="px-5 py-3 text-gray-900">{job.customer}</td>
                  <td className="px-5 py-3 text-gray-600">{job.vehicle}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
