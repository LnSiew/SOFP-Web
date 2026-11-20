
import { FormEvent, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  addDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  limit
} from 'firebase/firestore';
import { db } from './firebase';

type Page = 'dashboard' | 'devices' | 'history' | 'alarm';

type IconName =
  | Page
  | 'camera'
  | 'plus'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'logout'
  | 'close';

type Device = {
  id: string;
  name: string;
  place: string;
  status: string;
  people: number;
  thingsBoardId: string;
  battery: number | null;
  rssi: number | null;
  temperature: number | null;
  deviceState: string;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'US';
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    devices: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m9 19-1.5 2M15 19l1.5 2M9 9h6"/></>,
    camera: <><path d="M14.5 6 13 4H7L5.5 6H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5.5Z"/><circle cx="10" cy="12.5" r="3.5"/><path d="m22 10 3-2v9l-3-2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    alarm: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Login({ onLogin }: { onLogin: (user: { username: string; role: string }) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitted, setResetSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // จำนวนกล้องจาก Firestore สำหรับแสดงบนหน้า Login
  const [totalCameras, setTotalCameras] = useState(0);
  const [activeCameras, setActiveCameras] = useState(0);
  const [deviceCountError, setDeviceCountError] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'Devices'),
      snapshot => {
        const devices = snapshot.docs.map(item => item.data());

        setTotalCameras(devices.length);
        setActiveCameras(
          devices.filter(device => device.Status === 'Online').length
        );
        setDeviceCountError(false);
      },
      error => {
        console.error('Login device count error:', error);
        setDeviceCountError(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const userRef = doc(db, 'User', email.trim());
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError('Account not found');
        return;
      }

      const userData = userSnap.data();

      if (userData.Password !== password) {
        setError('Incorrect password');
        return;
      }

      onLogin({
        username: userData.Username || email,
        role: userData.Role || 'User'
      });
    } catch (error) {
      console.error('Firebase Login Error:', error);

      const firebaseError = error as {
        code?: string;
        message?: string;
      };

      setError(
        `Firebase Error: ${firebaseError.code || 'unknown'} - ${firebaseError.message || 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark large">
          <Icon name="camera" size={30}/>
        </div>
        <div>
          <div className="hero-title">Sofp vision</div>
        </div>
        <div className="signal-card">
          <div className="signal-live">
            <span className={deviceCountError ? 'offline-dot' : 'online-dot'} />
            {deviceCountError
              ? 'DEVICE DATA UNAVAILABLE'
              : 'DEVICE REGISTRY CONNECTED'}
          </div>
          <div className="signal-row">
            <b>{deviceCountError ? '—' : activeCameras}</b>
            <span>
              Active cameras / {deviceCountError ? '—' : totalCameras} registered
            </span>
          </div>
          <div className="signal-wave" aria-hidden="true">
            <i/><i/><i/><i/><i/><i/><i/><i/><i/>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-logo">
            <div className="brand-mark">
              <Icon name="camera"/>
            </div>
            <b>Sofp vision</b>
          </div>

          <div className="form-kicker">ADMIN PORTAL</div>
          <h1>Sign in to Sofp vision</h1>
          <p className="muted">
            Enter your administrator details to access the workspace.
          </p>

          <form onSubmit={submit}>
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>

            <label htmlFor="login-password">Password</label>

            <div className="password-wrap">
              <input
                id="login-password"
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="text-btn"
                aria-controls="login-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="form-help">
              <label className="check">
                <input type="checkbox" defaultChecked/>
                Remember me
              </label>

              <button
                className="text-btn"
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetSubmitted(false);
                  setResetOpen(true);
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p role="alert" style={{ color: '#dc2626' }}>
                {error}
              </p>
            )}

            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Checking...' : 'Sign in'}
              <Icon name="chevron" size={18}/>
            </button>
          </form>
        </div>
      </section>

      {resetOpen && (
        <div className="modal-backdrop" onClick={() => setResetOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="overline">SOFP VISION</span>
                <h2 id="reset-title">Forgot password?</h2>
              </div>

              <button className="icon-btn" onClick={() => setResetOpen(false)}>
                <Icon name="close"/>
              </button>
            </div>

            {resetSubmitted ? (
              <>
                <p className="muted">
                  Password recovery is not available yet.
                  Please contact your administrator.
                </p>
                <button className="primary-btn" onClick={() => setResetOpen(false)}>
                  Back to sign in
                </button>
              </>
            ) : (
              <form onSubmit={e => {
                e.preventDefault();
                setResetSubmitted(true);
              }}>
                <p className="muted">
                  Contact your administrator to reset your password.
                </p>

                <label>
                  Email address
                  <input
                    required
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                  />
                </label>

                <div className="modal-actions">
                  <button
                    className="outline-btn"
                    type="button"
                    onClick={() => setResetOpen(false)}
                  >
                    Cancel
                  </button>
                  <button className="primary-btn compact">
                    Continue
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Sidebar({
  page,
  setPage,
  onLogout,
  onAdd,
  onSelect,
  devices,
  selectedDevice,
  username,
  role
}: {
  selectedDevice: string | null;
  page: Page;
  setPage: (p: Page) => void;
  onLogout: () => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
  devices: Device[];
  username: string;
  role: string;
}) {
  const [showDevices, setShowDevices] = useState(true);
  const initials = getInitials(username);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const nav = (item: Page, label: string) => (
    <button className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => setPage(item)}>
      <Icon name={item}/><span>{label}</span>{item === 'alarm' && <em>3</em>}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="logo"><div className="brand-mark"><Icon name="camera"/></div><span>Sofp <b>vision</b></span></div>

      <div className="workspace-wrap">
        <button className="workspace" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen(!workspaceOpen)}>
          <div className="avatar small">SV</div>
          <div><b>Sofp vision HQ</b><span>Main workspace</span></div>
          <Icon name="chevron" size={15}/>
        </button>

        {workspaceOpen && (
          <div className="workspace-menu">
            <b>Sofp vision HQ</b>
            <p>{devices.length} devices · {devices.filter(device => device.status === 'Online').length} online</p>
            <button onClick={() => { setPage('dashboard'); setWorkspaceOpen(false); }}>Workspace overview</button>
            <button onClick={() => { setPage('devices'); setWorkspaceOpen(false); }}>Manage devices</button>
            <button onClick={() => { setPage('devices'); onAdd(); setWorkspaceOpen(false); }}>Add device</button>
          </div>
        )}
      </div>

      <nav>
        <span className="nav-label">OVERVIEW</span>
        {nav('dashboard', 'Dashboard')}

        <div className="device-nav">
          <div className="device-nav-head">
            <button className={`nav-item ${page === 'devices' ? 'active' : ''}`} onClick={() => { setPage('devices'); setShowDevices(true); }}>
              <Icon name="devices"/><span>Devices</span><strong>{devices.length}</strong>
            </button>
            <button className="hover-add" aria-label="Add device" onClick={() => { setPage('devices'); onAdd(); }}>
              <Icon name="plus" size={16}/>
            </button>
          </div>

          {showDevices && (
            <div className="device-list">
              {devices.map(device => (
                <button
                  key={device.id}
                  className={page === 'devices' && selectedDevice === device.id ? 'selected-device' : ''}
                  aria-current={page === 'devices' && selectedDevice === device.id ? 'page' : undefined}
                  onClick={() => { setPage('devices'); onSelect(device.id); }}
                >
                  <span className={device.status.toLowerCase()}/>
                  <div><b>{device.name}</b><small>{device.place}</small></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="nav-label second">ACTIVITY</span>
        {nav('history', 'History')}
        {nav('alarm', 'Alarm')}
      </nav>

      <div className="profile-wrap">
        {profileOpen && (
          <div className="profile-menu">
            <button onClick={onLogout}><Icon name="logout" size={15}/> Log out</button>
          </div>
        )}

        <button className="profile" onClick={() => setProfileOpen(!profileOpen)}>
          <div className="avatar">{initials}</div>
          <div><b>{username}</b><span>{role}</span></div>
          <Icon name="chevron" size={18}/>
        </button>
      </div>
    </aside>
  );
}

function Dashboard({
  devices,
  onSelect,
  username
}: {
  devices: Device[];
  onSelect: (id: string) => void;
  username: string;
}) {
  const online = devices.filter(device => device.status === 'Online' || device.deviceState === 'Active').length;
  const people = devices.reduce((total, device) => total + device.people, 0);
  const [activeAlarmCount, setActiveAlarmCount] = useState(0);

  useEffect(() => {
    const counts = new Map<string, number>();
    const unsubscribers = devices.map(device => onSnapshot(
      collection(db, 'Devices', device.id, 'AlarmLog'),
      snapshot => {
        counts.set(device.id, snapshot.docs.filter(item => item.data().Type !== 'config' && item.data().Status !== true).length);
        setActiveAlarmCount(Array.from(counts.values()).reduce((sum, count) => sum + count, 0));
      },
      error => console.error(`Dashboard alarm listener (${device.id}):`, error)
    ));
    if (devices.length === 0) setActiveAlarmCount(0);
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [devices]);

  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');

  useEffect(() => {
    const logsQuery = query(collection(db, 'HistoryLog'), orderBy('Time', 'desc'));

    const unsubscribe = onSnapshot(
      logsQuery,
      snapshot => {
        const data = snapshot.docs.slice(0, 4).map(item => ({
          id: item.id,
          ...item.data()
        }));

        setRecentEvents(data);
        setEventsLoading(false);
        setEventsError('');
      },
      error => {
        console.error('Recent events error:', error);
        setEventsError(error.message);
        setEventsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getRelativeTime = (value: any) => {
    if (!value) return '-';

    const date = value?.toDate ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '-';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;

    return formatLogTime(value);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="overline">MONDAY, 26 MAY</span>
          <h1>Good morning, {username}.</h1>
          <p>Here’s what’s happening across your camera network.</p>
        </div>
      </div>

      <div className="stats-grid">
        {[
          [String(devices.length), 'Total devices', 'Registered cameras', 'devices'],
          [String(online), 'Devices online', `${devices.length ? Math.round(online / devices.length * 100) : 0}% available`, 'camera'],
          [String(people), 'People detected', 'Latest snapshots', 'dashboard'],
          [String(activeAlarmCount), 'Active alarms', 'Needs attention', 'alarm']
        ].map(([n, l, s, i], index) => (
          <article className="stat-card" key={l}>
            <div className={`stat-icon c${index}`}><Icon name={i as IconName}/></div>
            <span>{l}</span>
            <b>{n}</b>
            <small>{s}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel camera-panel">
          <div className="panel-head">
            <div><h2>Live overview</h2><p>Latest camera snapshots</p></div>
          </div>

          {devices.length ? (
            <div className="camera-grid">
              {devices.slice(0, 3).map((d, i) => (
                <button className={`feed feed-${i}`} key={d.id} onClick={() => onSelect(d.id)}>
                  <div className="feed-top">
                    <span><i/>{d.status === 'Online' ? 'LIVE' : 'UNAVAILABLE'}</span>
                    <b>{d.people} people</b>
                  </div>
                  <div className="feed-bottom">
                    <b>{d.name}</b>
                    <span>{d.place}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state"><Icon name="camera"/><b>No camera data</b></div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Recent events</h2><p>Showing the latest activity</p></div>
          </div>

          <div className="activity-list">
            {eventsLoading && <div className="empty-state">Loading events...</div>}

            {eventsError && (
              <div className="empty-state">
                <Icon name="history"/>
                <b>Unable to load events</b>
                <span>{eventsError}</span>
              </div>
            )}

            {!eventsLoading && !eventsError && recentEvents.length === 0 && (
              <div className="empty-state">
                <Icon name="history"/>
                <b>No recent events</b>
                <span>No records found in HistoryLog.</span>
              </div>
            )}

            {!eventsLoading && !eventsError && recentEvents.map(event => {
              const deviceName = event.Device_Name || event.Device || event.Camera_Name || 'System';
              const eventName = event.Event || event.Action || event.Description || event.Message || event.Activity || event.Device_Name || event.id;

              return (
                <div key={event.id}>
                  <i className="event blue"><Icon name="history" size={17}/></i>
                  <p>
                    <b>{eventName}</b>
                    <span>{deviceName} · {getRelativeTime(event.Time)}</span>
                  </p>
                  <span className="event-state">Recorded</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function Devices({
  onAdd,
  onSelect,
  devices,
  query,
  setQuery
}: {
  onAdd: () => void;
  onSelect: (id: string) => void;
  devices: Device[];
  query: string;
  setQuery: (value: string) => void;
}) {
  const [status, setStatus] = useState('All');

  const filtered = devices.filter(device =>
    (status === 'All' || device.status === status) &&
    `${device.name} ${device.place}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="overline">DEVICE MANAGEMENT</span>
          <h1>Devices <span className="title-count">{filtered.length}</span></h1>
          <p>Monitor and manage every camera in your network.</p>
        </div>
        <button className="primary-btn compact" onClick={onAdd}>
          <Icon name="plus" size={18}/> Add device
        </button>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18}/>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or location..."/>
        </div>
        <select className="status-select" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="All">All status</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select>
      </div>

      {filtered.length ? (
        <div className="device-cards">
          {filtered.map((device, i) => (
            <article className="device-card" key={device.id} onClick={() => onSelect(device.id)}>
              <div className={`device-preview preview-${i}`}>
                <span className={`status-pill ${device.status.toLowerCase()}`}><i/>{device.status}</span>
                <Icon name="camera" size={38}/>
              </div>
              <div className="device-info">
                <div><h3>{device.name}</h3><p>{device.place}</p></div>
                <button aria-label={`View ${device.name}`}><Icon name="chevron" size={18}/></button>
                <dl>
                  <div><dt>People</dt><dd>{device.people}</dd></div>
                  <div><dt>Uptime</dt><dd>{device.status === 'Online' ? '99.8%' : '—'}</dd></div>
                  <div><dt>Quality</dt><dd>{device.status === 'Online' ? '1080p' : '—'}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" size={28}/>
          <b>No devices found</b>
          <span>Try another search or status.</span>
        </div>
      )}
    </>
  );
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DeviceTelemetryChart({ deviceId }: { deviceId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [metric, setMetric] = useState<'Battery' | 'RSSI' | 'Temperature' | 'People'>('Battery');
  const [range, setRange] = useState('24');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    const historyQuery = query(
      collection(db, 'Devices', deviceId, 'TelemetryHistory'),
      orderBy('CreatedAt', 'desc'),
      limit(1000)
    );
    const unsubscribe = onSnapshot(historyQuery, snapshot => {
      const data = snapshot.docs
        .filter(item => item.data().Type !== 'config')
        .map(item => ({ id: item.id, ...item.data() }));
      setRows(data);
      setLoading(false);
    }, err => {
      console.error('TelemetryHistory error:', err);
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [deviceId]);

  const cutoff = Date.now() - Number(range) * 60 * 60 * 1000;
  const points = rows
    .map(row => ({ ...row, date: toDate(row.CreatedAt) }))
    .filter(row => row.date && row.date.getTime() >= cutoff && row[metric] !== null && row[metric] !== undefined && Number.isFinite(Number(row[metric])))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const values = points.map(row => Number(row[metric]));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const spread = max - min || 1;
  const unit = metric === 'Battery' ? '%' : metric === 'RSSI' ? ' dBm' : metric === 'Temperature' ? '°C' : ' people';

  return (
    <section className="panel telemetry-panel">
      <div className="panel-head">
        <div><h2>Telemetry history</h2><p>{metric} · Recorded every 5 minutes</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="status-select" value={metric} onChange={e => setMetric(e.target.value as any)}>
            <option value="Battery">Battery (%)</option>
            <option value="RSSI">Signal · RSSI (dBm)</option>
            <option value="Temperature">Temperature (°C)</option>
            <option value="People">People</option>
          </select>
          <select className="status-select" value={range} onChange={e => setRange(e.target.value)}>
            <option value="1">Last 1 hour</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
            <option value="720">Last 30 days</option>
          </select>
        </div>
      </div>
      {loading ? <div className="empty-state">Loading telemetry...</div> : error ? <div className="empty-state" style={{ color: '#dc2626' }}>{error}</div> : points.length === 0 ? (
        <div className="empty-state"><b>No telemetry history yet</b><span>Backend will add a snapshot every 5 minutes.</span></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '8px 0 12px' }}>
            <b>{values[values.length - 1]}{unit}</b>
            <span className="muted">Min: {min}{unit} · Max: {max}{unit}</span>
            <span className="muted">{points.length} samples</span>
          </div>
          <div
            style={{ position: 'relative', width: '100%' }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <svg viewBox="0 0 700 220" role="img" aria-label={`${metric} telemetry chart`} style={{ display: 'block', width: '100%', height: 'auto', minHeight: 180, overflow: 'visible' }}>
              {[35, 83, 131, 180].map(y => <line key={y} x1="24" y1={y} x2="676" y2={y} stroke="currentColor" opacity="0.12"/>)}
              {values.length > 1 && <polyline points={values.map((value, index) => {
                const x = values.length <= 1 ? 350 : 24 + index * 652 / (values.length - 1);
                const y = 180 - ((value - min) / spread) * 145;
                return `${x},${y}`;
              }).join(' ')} fill="none" stroke="#399b78" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
              {values.map((value, index) => {
                const x = values.length <= 1 ? 350 : 24 + index * 652 / (values.length - 1);
                const y = 180 - ((value - min) / spread) * 145;
                const active = hoveredIndex === index;
                return (
                  <g key={points[index].id} onMouseEnter={() => setHoveredIndex(index)} style={{ cursor: 'pointer' }}>
                    <circle cx={x} cy={y} r="13" fill="transparent"/>
                    {active && <circle cx={x} cy={y} r="7.5" fill="#399b78" stroke="#d9f36a" strokeWidth="3"/>}
                    <circle cx={x} cy={y} r={active ? 4.5 : 5} fill="#399b78" stroke="white" strokeWidth="1.5"/>
                  </g>
                );
              })}
              <text x="24" y="210" fontSize="11" fill="currentColor" opacity="0.65">{points[0].date.toLocaleString()}</text>
              <text x="676" y="210" textAnchor="end" fontSize="11" fill="currentColor" opacity="0.65">{points[points.length - 1].date.toLocaleString()}</text>
            </svg>
            {hoveredIndex !== null && points[hoveredIndex] && (() => {
              const point = points[hoveredIndex];
              const x = values.length <= 1 ? 350 : 24 + hoveredIndex * 652 / (values.length - 1);
              const y = 180 - ((values[hoveredIndex] - min) / spread) * 145;
              const dateLabel = point.date.toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
              });
              const tooltipRows = [
                ['Battery', point.Battery, '%'],
                ['RSSI', point.RSSI, ' dBm']
              ].filter(([, value]) => value !== null && value !== undefined && Number.isFinite(Number(value)));
              if (tooltipRows.length === 0) tooltipRows.push([metric, point[metric], unit]);
              return (
                <div
                  role="status"
                  style={{
                    position: 'absolute',
                    left: `${x / 700 * 100}%`,
                    top: `${y / 220 * 100}%`,
                    transform: 'translate(-50%, calc(-100% - 14px))',
                    zIndex: 5,
                    minWidth: 114,
                    padding: '12px 14px',
                    borderRadius: 9,
                    background: '#123f32',
                    color: '#fff',
                    boxShadow: '0 8px 22px rgba(0,0,0,.22)',
                    fontSize: 11,
                    lineHeight: 1.65,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{dateLabel}</div>
                  {tooltipRows.map(([label, value, suffix]) => (
                    <div key={String(label)}>{label}: {value}{suffix}</div>
                  ))}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </section>
  );
}

function DevicePeopleLog({ deviceId }: { deviceId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, 'Devices', deviceId, 'PeopleLog'), orderBy('Time', 'desc'), limit(100));
    return onSnapshot(q, snap => {
      setRows(snap.docs.filter(d => d.data().Type !== 'config').map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error('PeopleLog error:', err); setLoading(false); });
  }, [deviceId]);
  return (
    <section className="panel table-panel">
      <div className="panel-head"><div><h2>People count changes</h2><p>Recorded only when the detected count changes</p></div></div>
      {loading ? <div className="empty-state">Loading people history...</div> : rows.length === 0 ? <div className="empty-state"><b>No people count changes</b></div> : (
        <div className="event-table">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .7fr', padding: 12, background: '#f4f6f5', borderRadius: 8, fontSize: 12 }}>
            <span>Time</span><span>Previous</span><span>Current</span><span>Change</span>
          </div>
          {rows.map(row => <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .7fr', alignItems: 'center', padding: '14px 12px', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
            <span>{formatLogTime(row.Time)}</span>
            <span>{Number(row.Previous ?? 0)} people</span>
            <b>{Number(row.Current ?? 0)} people</b>
            <span style={{ fontWeight: 600, color: Number(row.Change) >= 0 ? '#16845b' : '#c64d45' }}>{Number(row.Change) > 0 ? '+' : ''}{Number(row.Change ?? 0)}</span>
          </div>)}
        </div>
      )}
    </section>
  );
}

function DeviceAlarmLog({ deviceId }: { deviceId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, 'Devices', deviceId, 'AlarmLog'), orderBy('CreatedAt', 'desc'), limit(100));
    return onSnapshot(q, snap => {
      setRows(snap.docs.filter(d => d.data().Type !== 'config').map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error('AlarmLog error:', err); setLoading(false); });
  }, [deviceId]);
  const toggleStatus = async (row: any) => {
    setUpdating(current => [...current, row.id]);
    try {
      // ใช้พฤติกรรมเดียวกับ Alarm เดิม: true = Acknowledged, false = ยังไม่ Acknowledge
      await updateDoc(doc(db, 'Devices', deviceId, 'AlarmLog', row.id), { Status: row.Status !== true });
    } catch (err) { console.error('Update device alarm failed:', err); }
    finally { setUpdating(current => current.filter(id => id !== row.id)); }
  };
  return (
    <section className="panel table-panel">
      <div className="panel-head"><div><h2>Alarm history</h2><p>Device alerts and acknowledgement status</p></div></div>
      {loading ? <div className="empty-state">Loading alarms...</div> : rows.length === 0 ? <div className="empty-state"><b>No alarms recorded</b></div> : (
        <div className="event-table">{rows.map(row => <div key={row.id}>
          <i className="event orange"><Icon name="alarm" size={18}/></i>
          <p><b>{row.Event || 'Device alert'}</b><span>Time: {formatLogTime(row.CreatedAt)}</span><span>Signal: {row.Signal ?? '-'}</span><span>Battery: {row.Battery ?? '-'}</span></p>
          <button className={`event-state actionable ${row.Status === true ? 'acknowledged' : ''}`} disabled={updating.includes(row.id)} onClick={() => toggleStatus(row)}>{updating.includes(row.id) ? 'Updating...' : row.Status === true ? 'Acknowledged' : 'Acknowledge'}</button>
        </div>)}</div>
      )}
    </section>
  );
}

function DeviceDetail({ id, onBack, onEdit, devices }: { id: string; onBack: () => void; onEdit: () => void; devices: Device[] }) {
  const device = devices.find(item => item.id === id);
  if (!device) return <div className="empty-state"><Icon name="camera"/><b>Device not found</b><button className="outline-btn" onClick={onBack}>Back to devices</button></div>;
  const battery = device.battery;
  const rssi = device.rssi;
  const state = device.deviceState || device.status;
  const signalQuality = rssi === null ? 'No signal data' : rssi >= -60 ? 'Excellent connection' : rssi >= -75 ? 'Good connection' : 'Weak connection';
  return (
    <>
      <button className="back-btn" onClick={onBack}>‹ All devices</button>
      <div className="page-heading detail-heading">
        <div><span className="overline">DEVICE DETAIL</span><h1>{device.name}</h1><p>{device.place}</p></div>
        <div className="detail-actions"><span className={`detail-status ${state.toLowerCase()}`}><i/>{state}</span><button className="outline-btn" onClick={onEdit}>Edit device</button></div>
      </div>
      <div className="detail-layout">
        <div className="detail-left">
          <div className="device-metrics">
            <article><span>BATTERY</span><b>{battery === null ? '—' : battery}<small>{battery === null ? '' : '%'}</small></b><p>{battery === null ? 'Waiting for telemetry' : 'Latest reported value'}</p></article>
            <article><span>SIGNAL · RSSI</span><b>{rssi === null ? '—' : rssi}<small>{rssi === null ? '' : ' dBm'}</small></b><p>{signalQuality}</p></article>
            <article><span>DEVICE STATE</span><b className={state.toLowerCase() === 'active' || state.toLowerCase() === 'online' ? 'active-text' : ''}>{state}</b><p>Latest reported state</p></article>
          </div>
          <DeviceTelemetryChart deviceId={id}/>
        </div>
        <section className="panel live-detail">
          <div className="panel-head"><div><h2>Live camera</h2><p>Camera stream integration pending</p></div><span className="live-badge"><i/>{state === 'Active' || state === 'Online' ? 'LIVE' : 'OFFLINE'}</span></div>
          <div className="detail-feed"><div className="scan-line"/><div className="feed-data"><span>{device.people} people detected</span><b>{device.temperature === null ? '—' : `${device.temperature} °C`}</b></div></div>
        </section>
      </div>
      <DevicePeopleLog deviceId={id}/>
      <DeviceAlarmLog deviceId={id}/>
    </>
  );
}

function formatLogTime(value: any) {
  if (!value) return '-';

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function SimplePage({
  page,
  devices
}: {
  page: 'history' | 'alarm';
  devices: Device[];
}) {
  const alarm = page === 'alarm';

  const [filter, setFilter] = useState('All');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  const collectionName = alarm ? 'SecurityLog' : 'HistoryLog';

  useEffect(() => {
    setLoading(true);
    setError('');

    const logsQuery = query(collection(db, collectionName), orderBy('Time', 'desc'));

    const unsubscribe = onSnapshot(
      logsQuery,
      snapshot => {
        const data = snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        }));

        setRows(data);
        setLoading(false);
      },
      err => {
        console.error('Firestore Log Error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

  const acknowledgeAlarm = async (rowId: string) => {
    if (!alarm) return;

    const currentRow = rows.find(row => row.id === rowId);
    if (!currentRow) return;

    setUpdatingIds(current => [...current, rowId]);

    try {
      await updateDoc(doc(db, 'SecurityLog', rowId), {
        Status: currentRow.Status !== true
      });
    } catch (err: any) {
      console.error('Update alarm error:', err);
      setError(`ไม่สามารถอัปเดต Alarm ได้: ${err.message}`);
    } finally {
      setUpdatingIds(current => current.filter(id => id !== rowId));
    }
  };

  const filteredRows = rows.filter(row => {
    if (filter === 'All') return true;

    const date = row.Time?.toDate ? row.Time.toDate() : new Date(row.Time);
    if (isNaN(date.getTime())) return false;

    const now = new Date();

    if (filter === 'Today') {
      return date.toDateString() === now.toDateString();
    }

    if (filter === 'Last 7 days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return date >= sevenDaysAgo && date <= now;
    }

    return true;
  });

  const unresolvedAlarms = rows.filter(row => row.Status === false).length;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="overline">{alarm ? 'SECURITY CENTER' : 'EVENT LOG'}</span>
          <h1>{alarm ? 'Alarm' : 'History'}</h1>
          <p>
            {alarm
              ? 'Review events that need your attention.'
              : 'Browse camera and system activity across your network.'}
          </p>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>{alarm ? 'Security logs' : 'Recent events'}</h2>
            <p>
              {loading
                ? 'Loading data...'
                : alarm
                  ? `${unresolvedAlarms} unresolved alarms`
                  : `${filteredRows.length} records found`}
            </p>
          </div>

          <select className="status-select" value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="Today">Today</option>
            <option value="Last 7 days">Last 7 days</option>
          </select>
        </div>

        {loading && <div className="empty-state">Loading logs...</div>}

        {error && <div className="empty-state" style={{ color: '#dc2626' }}>{error}</div>}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="empty-state">
            <Icon name="history" size={28}/>
            <b>No records found</b>
            <span>There are no logs to display.</span>
          </div>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="event-table">
            {filteredRows.map(row => {
              const acknowledged = row.Status === true;
              const updating = updatingIds.includes(row.id);

              return (
                <div key={row.id}>
                  <i className={`event ${alarm ? 'orange' : 'blue'}`}>
                    <Icon name={alarm ? 'alarm' : 'history'} size={18}/>
                  </i>

                  <p>
                    <b>{row.Device_Name || row.id}</b>
                    <span>Time: {formatLogTime(row.Time)}</span>
                    <span>Signal: {row.Signal ?? '-'}</span>
                    <span>Battery: {row.Battery ?? '-'}</span>
                  </p>

                  {alarm ? (
                    <button
                      className={`event-state actionable ${acknowledged ? 'acknowledged' : ''}`}
                      disabled={updating}
                      onClick={() => acknowledgeAlarm(row.id)}
                    >
                      {updating ? 'Updating...' : acknowledged ? 'Acknowledged' : 'Acknowledge'}
                    </button>
                  ) : (
                    <span className="event-state">Recorded</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

// ตรวจสอบข้อมูลซ้ำ
const normalizeDeviceValue = (value: string) =>
  value.trim().toLowerCase();

async function checkDeviceDuplicate(
  name: string,
  thingsBoardId: string,
  excludeId?: string
) {
  const snapshot = await getDocs(collection(db, 'Devices'));

  const normalizedName = normalizeDeviceValue(name);
  const normalizedTbId = normalizeDeviceValue(thingsBoardId);

  for (const item of snapshot.docs) {
    if (excludeId && item.id === excludeId) continue;

    const data = item.data();

    const existingName = normalizeDeviceValue(data.Name || '');
    const existingTbId = normalizeDeviceValue(data.ThingsBoardId || '');

    if (existingName && existingName === normalizedName) {
      throw new Error('Device name already exists.');
    }

    if (existingTbId && existingTbId === normalizedTbId) {
      throw new Error('ThingsBoard Device ID already exists.');
    }
  }
}

// เพิ่ม Device
async function createDevice(
  name: string,
  location: string,
  thingsBoardId: string
) {
  const cleanName = name.trim();
  const cleanLocation = location.trim();
  const cleanTbId = thingsBoardId.trim();

  if (!cleanName || !cleanLocation || !cleanTbId) {
    throw new Error('Please fill in all fields.');
  }

  await checkDeviceDuplicate(cleanName, cleanTbId);

  const docRef = await addDoc(collection(db, 'Devices'), {
    Name: cleanName,
    Location: cleanLocation,
    ThingsBoardId: cleanTbId,
    Status: 'Offline',
    DeviceState: 'Inactive',
    People: 0,
    Battery: null,
    RSSI: null,
    Temperature: null,
    CreatedAt: serverTimestamp(),
    UpdatedAt: null
  });

  // Firestore จะมี Subcollection เมื่อมี document อย่างน้อยหนึ่งรายการ
  // _config เป็น metadata ไม่ใช่ log จริง และหน้า Dashboard จะกรองออก
  const config = { Type: 'config', CreatedAt: serverTimestamp(), Retention: 'backend-managed' };
  await Promise.all([
    setDoc(doc(db, 'Devices', docRef.id, 'PeopleLog', '_config'), { ...config, Collection: 'PeopleLog' }),
    setDoc(doc(db, 'Devices', docRef.id, 'AlarmLog', '_config'), { ...config, Collection: 'AlarmLog' }),
    setDoc(doc(db, 'Devices', docRef.id, 'TelemetryHistory', '_config'), {
      ...config,
      Collection: 'TelemetryHistory',
      IntervalMinutes: 5,
      Fields: ['Battery', 'RSSI', 'Temperature', 'People']
    })
  ]);

  return docRef.id;
}

// แก้ไข Device
async function saveDevice(
  deviceId: string,
  name: string,
  location: string,
  thingsBoardId: string
) {
  const cleanName = name.trim();
  const cleanLocation = location.trim();
  const cleanTbId = thingsBoardId.trim();

  if (!cleanName || !cleanLocation || !cleanTbId) {
    throw new Error('Please fill in all fields.');
  }

  await checkDeviceDuplicate(cleanName, cleanTbId, deviceId);

  await updateDoc(doc(db, 'Devices', deviceId), {
    Name: cleanName,
    Location: cleanLocation,
    ThingsBoardId: cleanTbId
  });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
  } | null>(null);

  const userInitials = getInitials(currentUser?.username || 'User');

  const [page, setPage] = useState<Page>('dashboard');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceQuery, setDeviceQuery] = useState('');
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceError, setDeviceError] = useState('');

  // โหลด Device จาก Firebase แบบ Real-time
  useEffect(() => {
    if (!loggedIn) {
      setDevices([]);
      setDevicesLoading(false);
      return;
    }

    setDevicesLoading(true);
    setDeviceError('');

    const unsubscribe = onSnapshot(
      collection(db, 'Devices'),
      snapshot => {
        const data: Device[] = snapshot.docs.map(item => {
          const deviceData = item.data();

          return {
            id: item.id,
            name: deviceData.Name || '',
            place: deviceData.Location || '',
            thingsBoardId: deviceData.ThingsBoardId || '',
            status: deviceData.Status || 'Offline',
            people: Number(deviceData.People ?? 0),
            battery: deviceData.Battery === null || deviceData.Battery === undefined ? null : Number(deviceData.Battery),
            rssi: deviceData.RSSI === null || deviceData.RSSI === undefined ? null : Number(deviceData.RSSI),
            temperature: deviceData.Temperature === null || deviceData.Temperature === undefined ? null : Number(deviceData.Temperature),
            deviceState: deviceData.DeviceState || deviceData.Status || 'Inactive'
          };
        });

        setDevices(data);
        setDevicesLoading(false);
        setDeviceError('');
      },
      error => {
        console.error('Load Devices Error:', error);
        setDeviceError(error.message);
        setDevicesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <Login
        onLogin={user => {
          setCurrentUser(user);
          setLoggedIn(true);
        }}
      />
    );
  }

  const activeDevice = devices.find(device => device.id === selectedDevice);

  const handleAddDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await createDevice(
        String(data.get('name') || ''),
        String(data.get('place') || ''),
        String(data.get('thingboardId') || '')
      );

      setAddOpen(false);
    } catch (error) {
      console.error('Add Device Error:', error);
      alert(error instanceof Error ? error.message : 'Unable to add device.');
    }
  };

  const handleEditDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeDevice) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await saveDevice(
        activeDevice.id,
        String(data.get('name') || ''),
        String(data.get('place') || ''),
        String(data.get('thingboardId') || '')
      );

      setEditOpen(false);
    } catch (error) {
      console.error('Edit Device Error:', error);
      alert(error instanceof Error ? error.message : 'Unable to update device.');
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        selectedDevice={selectedDevice}
        devices={devices}
        page={page}
        username={currentUser?.username || 'User'}
        role={currentUser?.role || 'User'}
        setPage={next => {
          setPage(next);
          setSelectedDevice(null);
        }}
        onLogout={() => {
          setLoggedIn(false);
          setCurrentUser(null);
          setSelectedDevice(null);
        }}
        onAdd={() => setAddOpen(true)}
        onSelect={id => {
          setSelectedDevice(id);
          setPage('devices');
        }}
      />

      <main className="app-main">
        <header>
          <form
            className="search top-search"
            onSubmit={event => {
              event.preventDefault();
              setSelectedDevice(null);
              setPage('devices');
            }}
          >
            <Icon name="search" size={18}/>
            <input
              value={deviceQuery}
              onChange={event => setDeviceQuery(event.target.value)}
              placeholder="Search devices..."
            />
            <kbd>Enter</kbd>
          </form>

          <div className="header-actions">
            <div className="alert-wrap">
              <button className="icon-btn" onClick={() => setAlertsOpen(!alertsOpen)}>
                <Icon name="bell"/>
                <i/>
              </button>

              {alertsOpen && (
                <div className="alert-popover">
                  <div className="alert-title">
                    <b>Notifications</b>
                    <span>3 new</span>
                  </div>

                  {[
                    'Motion detected after hours',
                    'Camera connection lost',
                    'Restricted area activity'
                  ].map((alert, index) => (
                    <button
                      key={alert}
                      onClick={() => {
                        setPage('alarm');
                        setSelectedDevice(null);
                        setAlertsOpen(false);
                      }}
                    >
                      <i className="event orange"><Icon name="alarm" size={15}/></i>
                      <span>
                        <b>{alert}</b>
                        <small>{devices[index]?.name ?? 'System'} · {index * 7 + 2}m ago</small>
                      </span>
                    </button>
                  ))}

                  <button
                    className="view-alerts"
                    onClick={() => {
                      setPage('alarm');
                      setSelectedDevice(null);
                      setAlertsOpen(false);
                    }}
                  >
                    View all alarms
                  </button>
                </div>
              )}
            </div>

            <div className="avatar">{userInitials}</div>
          </div>
        </header>

        <div className="content">
          {devicesLoading ? (
            <div className="empty-state"><b>Loading devices...</b></div>
          ) : deviceError ? (
            <div className="empty-state" style={{ color: '#dc2626' }}>
              <b>Unable to load devices</b>
              <span>{deviceError}</span>
            </div>
          ) : (
            <>
              {page === 'dashboard' && (
                <Dashboard
                  devices={devices}
                  username={currentUser?.username || 'User'}
                  onSelect={id => {
                    setSelectedDevice(id);
                    setPage('devices');
                  }}
                />
              )}

              {page === 'devices' && (
                selectedDevice ? (
                  <DeviceDetail
                    devices={devices}
                    id={selectedDevice}
                    onBack={() => setSelectedDevice(null)}
                    onEdit={() => setEditOpen(true)}
                  />
                ) : (
                  <Devices
                    devices={devices}
                    query={deviceQuery}
                    setQuery={setDeviceQuery}
                    onAdd={() => setAddOpen(true)}
                    onSelect={setSelectedDevice}
                  />
                )
              )}

              {(page === 'history' || page === 'alarm') && (
                <SimplePage devices={devices} page={page}/>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Device Modal */}
      {addOpen && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAddDevice}>
            <div className="modal-head">
              <div>
                <span className="overline">NEW CAMERA</span>
                <h2>Add device</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setAddOpen(false)}>
                <Icon name="close"/>
              </button>
            </div>

            <label>
              Device name
              <input name="name" required placeholder="e.g. CAM-Lobby 01"/>
            </label>

            <label>
              Location
              <input name="place" required placeholder="e.g. Main lobby"/>
            </label>

            <label>
              ThingsBoard device ID
              <input name="thingboardId" required placeholder="Enter ThingsBoard Device UUID"/>
            </label>

            <div className="modal-actions">
              <button type="button" className="outline-btn" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button className="primary-btn compact">Add device</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Device Modal */}
      {editOpen && activeDevice && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleEditDevice}>
            <div className="modal-head">
              <div>
                <span className="overline">DEVICE SETTINGS</span>
                <h2>Edit device</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditOpen(false)}>
                <Icon name="close"/>
              </button>
            </div>

            <label>
              Device name
              <input name="name" required defaultValue={activeDevice.name}/>
            </label>

            <label>
              Location
              <input name="place" required defaultValue={activeDevice.place}/>
            </label>

            <label>
              ThingsBoard device ID
              <input name="thingboardId" required defaultValue={activeDevice.thingsBoardId}/>
            </label>

            <div className="modal-actions">
              <button type="button" className="outline-btn" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button className="primary-btn compact">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
