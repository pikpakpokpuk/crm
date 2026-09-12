import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
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

const norm = (s: string) => s.toLowerCase() as JobStatus;
const normP = (s: string) => s.toLowerCase() as Priority;

interface StatsData { activeJobs: number; totalCustomers: number; readyJobs: number; }

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<StatsData>({ activeJobs: 0, totalCustomers: 0, readyJobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ jobs: Job[] }>('/jobs?limit=5'),
      api.get<{ total: number }>('/jobs?status=IN_PROGRESS'),
      api.get<{ total: number }>('/customers'),
      api.get<{ total: number }>('/jobs?status=READY'),
    ]).then(([recent, active, customers, ready]) => {
      setRecentJobs(recent.jobs);
      setStats({ activeJobs: active.total, totalCustomers: customers.total, readyJobs: ready.total });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const STATS = [
    { label: 'Active Jobs', value: String(stats.activeJobs), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Customers', value: String(stats.totalCustomers), color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Ready for Pickup', value: String(stats.readyJobs), color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-3`}>
              <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            <p className="text-gray-900 font-semibold">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Jobs</h3>
          <a href="/jobs" className="text-blue-600 text-sm hover:underline">View all →</a>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
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
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                    <td className="px-5 py-3 font-mono text-blue-600 font-medium">{job.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-gray-900">{job.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {job.vehicleMake ? `${job.vehicleMake} ${job.vehicleModel ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${STATUS_COLORS[norm(job.status)]}`}>
                        {norm(job.status).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${PRIORITY_COLORS[normP(job.priority)]}`}>
                        {normP(job.priority)}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentJobs.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No jobs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
