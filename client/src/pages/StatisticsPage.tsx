import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface JobRow {
  jobId: string;
  description: string;
  damageType: string | null;
  status: string;
  createdAt: string;
  materialRevenue: number; materialCost: number;
  manpowerRevenue: number; manpowerCost: number;
  totalRevenue: number; totalCost: number; profit: number;
  marginPct: number | null; hasIncompleteCostData: boolean;
}

interface JobsStatsResponse {
  jobs: JobRow[]; count: number;
  totalRevenue: number; totalCost: number; totalProfit: number; avgMarginPct: number | null;
}

interface JobTypeRow { jobType: string; count: number; avgMarginPct: number | null; totalProfit: number; totalRevenue: number; }

interface EmployeeRow {
  userId: string; name: string; jobsCount: number; hours: number;
  revenue: number; manpowerCost: number; jobs: { id: string; description: string }[];
}

interface MonthlyRow {
  month: string; totalRevenue: number; totalCost: number; totalProfit: number; jobCount: number;
  breakdown: { jobType: string; revenue: number; cost: number; profit: number }[];
}

const COLOR_REVENUE = '#2a78d6';
const COLOR_COST = '#eb6834';
const COLOR_PROFIT = '#1baf7a';

const money = (n: number) => `€${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`);

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarGroup({ title, series, unit }: { title: string; series: { label: string; values: { key: string; value: number }[]; color: string }[]; unit: (n: number) => string }) {
  const keys = series[0]?.values.map((v) => v.key) ?? [];
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.value)));
  const [hover, setHover] = useState<{ key: string; label: string; value: number; color: string } | null>(null);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {hover && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none z-10">
            {hover.label}: {unit(hover.value)}
          </div>
        )}
        <div className="flex items-end gap-4 h-48 border-b border-gray-200">
          {keys.map((key) => (
            <div key={key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="flex items-end gap-1 w-full justify-center h-40">
                {series.map((s) => {
                  const v = s.values.find((x) => x.key === key)?.value ?? 0;
                  const h = Math.max(2, (v / max) * 100);
                  return (
                    <div
                      key={s.label}
                      className="rounded-t-sm w-4 transition-opacity"
                      style={{ height: `${h}%`, backgroundColor: s.color, opacity: hover && hover.key === key && hover.color !== s.color ? 0.5 : 1 }}
                      onMouseEnter={() => setHover({ key, label: `${key} · ${s.label}`, value: v, color: s.color })}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </div>
              <span className="text-[11px] text-gray-400 truncate w-full text-center">{key}</span>
            </div>
          ))}
          {keys.length === 0 && <p className="text-sm text-gray-400 pb-4">No data in range.</p>}
        </div>
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(() => new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => today.toISOString().slice(0, 10));
  const [jobType, setJobType] = useState('');

  const [jobsStats, setJobsStats] = useState<JobsStatsResponse | null>(null);
  const [jobTypes, setJobTypes] = useState<JobTypeRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [sortKey, setSortKey] = useState<keyof JobRow>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(() => {
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (jobType) params.set('jobType', jobType);
    api.get<JobsStatsResponse>(`/stats/jobs?${params.toString()}`).then(setJobsStats).catch(console.error);
    api.get<JobTypeRow[]>('/stats/job-types').then(setJobTypes).catch(console.error);
    api.get<EmployeeRow[]>(`/stats/employees?dateFrom=${dateFrom}&dateTo=${dateTo}`).then(setEmployees).catch(console.error);

    const from = dateFrom.slice(0, 7);
    const to = dateTo.slice(0, 7);
    api.get<MonthlyRow[]>(`/stats/monthly-range?from=${from}&to=${to}`).then(setMonthly).catch(console.error);
  }, [dateFrom, dateTo, jobType]);

  useEffect(() => { load(); }, [load]);

  const sortedJobs = useMemo(() => {
    const rows = jobsStats?.jobs ?? [];
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [jobsStats, sortKey, sortDir]);

  const toggleSort = (key: keyof JobRow) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const monthlySeries = [
    { label: 'Revenue', color: COLOR_REVENUE, values: monthly.map((m) => ({ key: m.month, value: m.totalRevenue })) },
    { label: 'Cost', color: COLOR_COST, values: monthly.map((m) => ({ key: m.month, value: m.totalCost })) },
    { label: 'Profit', color: COLOR_PROFIT, values: monthly.map((m) => ({ key: m.month, value: m.totalProfit })) },
  ];

  const jobTypeSeries = [
    { label: 'Avg margin %', color: COLOR_REVENUE, values: jobTypes.map((t) => ({ key: t.jobType, value: t.avgMarginPct ?? 0 })) },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Statistics</h2>
        <p className="text-gray-500 mt-1">Job costing, margins, and team performance</p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Job Type</label>
          <select className="input w-auto" value={jobType} onChange={(e) => setJobType(e.target.value)}>
            <option value="">All types</option>
            {jobTypes.map((t) => <option key={t.jobType} value={t.jobType}>{t.jobType}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Total Revenue" value={money(jobsStats?.totalRevenue ?? 0)} sub={`${jobsStats?.count ?? 0} jobs`} />
        <StatTile label="Total Cost" value={money(jobsStats?.totalCost ?? 0)} />
        <StatTile label="Total Profit" value={money(jobsStats?.totalProfit ?? 0)} />
        <StatTile label="Avg Margin" value={pct(jobsStats?.avgMarginPct ?? null)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BarGroup title="Monthly Revenue / Cost / Profit" series={monthlySeries} unit={money} />
        <BarGroup title="Avg Margin % by Job Type" series={jobTypeSeries} unit={(n) => `${n.toFixed(1)}%`} />
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Employee Leaderboard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Jobs</th>
                <th className="px-5 py-3 font-medium">Hours</th>
                <th className="px-5 py-3 font-medium">Revenue Generated</th>
                <th className="px-5 py-3 font-medium">Manpower Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((e) => (
                <tr key={e.userId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-5 py-3 text-gray-600">{e.jobsCount}</td>
                  <td className="px-5 py-3 text-gray-600">{e.hours.toFixed(1)}</td>
                  <td className="px-5 py-3 text-gray-900 font-medium">{money(e.revenue)}</td>
                  <td className="px-5 py-3 text-gray-600">{money(e.manpowerCost)}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No employee activity in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Jobs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                {([
                  ['createdAt', 'Date'], ['description', 'Job'], ['damageType', 'Type'],
                  ['totalRevenue', 'Revenue'], ['totalCost', 'Cost'], ['profit', 'Profit'], ['marginPct', 'Margin'],
                ] as [keyof JobRow, string][]).map(([key, label]) => (
                  <th key={key} className="px-5 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort(key)}>
                    {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedJobs.map((j) => (
                <tr key={j.jobId} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/jobs/${j.jobId}`)}>
                  <td className="px-5 py-3 text-gray-500 text-xs">{j.createdAt.slice(0, 10)}</td>
                  <td className="px-5 py-3 text-gray-900">{j.description}</td>
                  <td className="px-5 py-3 text-gray-600">{j.damageType ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-900">{money(j.totalRevenue)}</td>
                  <td className="px-5 py-3 text-gray-600">{money(j.totalCost)}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{money(j.profit)}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      {pct(j.marginPct)}
                      {j.hasIncompleteCostData && <span title="Incomplete cost data — some costs missing" className="text-yellow-500 text-xs">⚠</span>}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedJobs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No jobs in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
