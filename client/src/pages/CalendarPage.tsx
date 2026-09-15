import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { api } from '@/lib/api';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales: { 'en-US': enUS },
});

interface EmployeeOption {
  id: string;
  name: string;
  calendarColor: string;
}

interface RawEvent {
  type: 'job' | 'manual';
  id?: string;
  jobId?: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  allDay?: boolean;
  userId: string | null;
  userName: string | null;
  color: string;
}

interface CalEvent {
  key: string;
  type: 'job' | 'manual';
  refId: string | null;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  userId: string | null;
  userName: string | null;
  color: string;
}

interface EventForm {
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  userId: string;
}

const EMPTY_FORM: EventForm = { title: '', description: '', start: '', end: '', allDay: false, userId: '' };

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  });
  const [view, setView] = useState<View>('month');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: EventForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ employees: EmployeeOption[] }>('/employees?limit=100')
      .then((r) => {
        setEmployees(r.employees);
        setSelected(new Set(r.employees.map((e) => e.id)));
      })
      .catch(console.error);
  }, []);

  const loadEvents = useCallback(() => {
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() });
    if (employees.length > 0 && selected.size < employees.length) {
      params.set('userIds', Array.from(selected).join(','));
    }
    api.get<RawEvent[]>(`/calendar/events?${params.toString()}`)
      .then((raw) => {
        setEvents(raw.map((e, i) => ({
          key: `${e.type}-${e.jobId ?? e.id}-${i}`,
          type: e.type,
          refId: e.type === 'job' ? e.jobId ?? null : e.id ?? null,
          title: e.title,
          description: e.description,
          start: new Date(e.start),
          end: new Date(e.end),
          allDay: e.allDay ?? false,
          userId: e.userId,
          userName: e.userName,
          color: e.color,
        })));
      })
      .catch(console.error);
  }, [range, selected, employees.length]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const toggleEmployee = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRangeChange = (r: Date[] | { start: Date; end: Date }) => {
    if (Array.isArray(r)) {
      if (r.length === 0) return;
      setRange({ start: r[0], end: r[r.length - 1] });
    } else {
      setRange({ start: r.start, end: r.end });
    }
  };

  const openCreate = (slot?: SlotInfo) => {
    setError('');
    setModal({
      mode: 'create',
      form: {
        ...EMPTY_FORM,
        start: toLocalInput(slot?.start ?? new Date()),
        end: toLocalInput(slot?.end ?? new Date(Date.now() + 60 * 60 * 1000)),
      },
    });
  };

  const openEdit = (ev: CalEvent) => {
    if (ev.type === 'job') { navigate(`/jobs/${ev.refId}`); return; }
    setError('');
    setModal({
      mode: 'edit',
      id: ev.refId ?? undefined,
      form: {
        title: ev.title,
        description: ev.description ?? '',
        start: toLocalInput(ev.start),
        end: toLocalInput(ev.end),
        allDay: ev.allDay,
        userId: ev.userId ?? '',
      },
    });
  };

  const saveEvent = async () => {
    if (!modal) return;
    if (!modal.form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        title: modal.form.title.trim(),
        description: modal.form.description || null,
        startAt: new Date(modal.form.start).toISOString(),
        endAt: new Date(modal.form.end).toISOString(),
        allDay: modal.form.allDay,
        userId: modal.form.userId || null,
      };
      if (modal.mode === 'create') {
        await api.post('/calendar/events', body);
      } else if (modal.id) {
        await api.put(`/calendar/events/${modal.id}`, body);
      }
      setModal(null);
      loadEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!modal?.id) return;
    setSaving(true);
    try {
      await api.delete(`/calendar/events/${modal.id}`);
      setModal(null);
      loadEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const eventPropGetter = useCallback((event: CalEvent) => ({
    style: {
      backgroundColor: event.color,
      borderColor: event.color,
      opacity: event.type === 'job' ? 1 : 0.85,
    },
  }), []);

  const components = useMemo(() => ({
    event: ({ event }: { event: CalEvent }) => (
      <span>
        {event.type === 'job' && '🔧 '}
        {event.title}
        {event.userName ? ` · ${event.userName}` : ''}
      </span>
    ),
  }), []);

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
          <p className="text-gray-500 mt-1">Job schedules and team events</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()}>+ Add Event</button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-56 shrink-0 card p-4 space-y-2 h-fit">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Employees</p>
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
              <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleEmployee(emp.id)} />
              <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: emp.calendarColor }} />
              <span className="truncate">{emp.name}</span>
            </label>
          ))}
          {employees.length === 0 && <p className="text-xs text-gray-400">No employees yet.</p>}
        </div>

        <div className="flex-1 card p-4 min-h-[600px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            onRangeChange={handleRangeChange}
            selectable
            onSelectSlot={openCreate}
            onSelectEvent={openEdit}
            eventPropGetter={eventPropGetter}
            components={components}
            style={{ height: '100%' }}
          />
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">{modal.mode === 'create' ? 'New Event' : 'Edit Event'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input className="input" value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea className="input resize-none" rows={2} value={modal.form.description} onChange={(e) => setModal({ ...modal, form: { ...modal.form, description: e.target.value } })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                  <input type="datetime-local" className="input" value={modal.form.start} onChange={(e) => setModal({ ...modal, form: { ...modal.form, start: e.target.value } })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                  <input type="datetime-local" className="input" value={modal.form.end} onChange={(e) => setModal({ ...modal, form: { ...modal.form, end: e.target.value } })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Employee (optional)</label>
                <select className="input" value={modal.form.userId} onChange={(e) => setModal({ ...modal, form: { ...modal.form, userId: e.target.value } })}>
                  <option value="">Unassigned</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={modal.form.allDay} onChange={(e) => setModal({ ...modal, form: { ...modal.form, allDay: e.target.checked } })} />
                All day
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-between pt-2">
                {modal.mode === 'edit' ? (
                  <button className="btn btn-secondary text-red-600" onClick={deleteEvent} disabled={saving}>Delete</button>
                ) : <span />}
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEvent} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
