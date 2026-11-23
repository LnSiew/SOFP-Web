
import { FormEvent, useState, useEffect, useRef } from 'react';
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

/* =========================================================
   1. TYPES AND DATA STRUCTURES
   กำหนดประเภทข้อมูลหลักที่ใช้ภายในเว็บไซต์
========================================================= */

// หน้าที่สามารถเปิดใช้งานได้
type Page = 'dashboard' | 'devices' | 'history' | 'alarm';

// ชื่อ Icon ที่รองรับภายในเว็บไซต์
type IconName =
  | Page
  | 'camera'
  | 'plus'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'logout'
  | 'close';

// โครงสร้างข้อมูลของ Device
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

/* =========================================================
   2. COMMON HELPER FUNCTIONS
   ฟังก์ชันกลางที่ใช้ร่วมกันหลายหน้า
========================================================= */

// แปลงชื่อผู้ใช้เป็นอักษรย่อสำหรับ Avatar
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

// แปลง Timestamp หรือวันที่ให้เป็น Date
function toDate(value: any): Date | null {
  if (!value) return null;

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// แสดงวันที่และเวลาในรูปแบบภาษาไทย
function formatLogTime(value: any) {
  if (!value) return '-';

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/* =========================================================
   3. ICON COMPONENT
   Component สำหรับแสดง SVG Icon ภายในเว็บไซต์
========================================================= */

function Icon({
  name,
  size = 20
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2"/>
        <rect x="14" y="3" width="7" height="7" rx="2"/>
        <rect x="3" y="14" width="7" height="7" rx="2"/>
        <rect x="14" y="14" width="7" height="7" rx="2"/>
      </>
    ),

    devices: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3"/>
        <path d="m9 19-1.5 2M15 19l1.5 2M9 9h6"/>
      </>
    ),

    camera: (
      <>
        <path d="M14.5 6 13 4H7L5.5 6H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5.5Z"/>
        <circle cx="10" cy="12.5" r="3.5"/>
        <path d="m22 10 3-2v9l-3-2"/>
      </>
    ),

    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
        <path d="M3 3v5h5M12 7v5l3 2"/>
      </>
    ),

    alarm: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>
      </>
    ),

    plus: <path d="M12 5v14M5 12h14"/>,

    search: (
      <>
        <circle cx="11" cy="11" r="7"/>
        <path d="m20 20-4-4"/>
      </>
    ),

    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>
      </>
    ),

    chevron: <path d="m9 18 6-6-6-6"/>,

    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>
      </>
    ),

    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* =========================================================
   4. LOGIN PAGE
   ระบบเข้าสู่ระบบและแสดงจำนวนกล้องจาก Firestore
========================================================= */

function Login({
  onLogin
}: {
  onLogin: (user: {
    username: string;
    role: string;
  }) => void;
}) {
  // สถานะของช่อง Login
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // สถานะหน้าต่าง Forgot Password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitted, setResetSubmitted] = useState(false);

  // สถานะการ Login
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // จำนวนกล้องจาก Firestore
  const [totalCameras, setTotalCameras] = useState(0);
  const [activeCameras, setActiveCameras] = useState(0);
  const [deviceCountError, setDeviceCountError] = useState(false);

  // Subscribe จำนวน Device แบบ Real-time
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

  // ตรวจสอบบัญชีผู้ใช้จาก Firestore
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

      {/* ส่วนแสดงแบรนด์และสถานะกล้อง */}
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

      {/* ส่วนกรอกข้อมูลเข้าสู่ระบบ */}
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

            {/* Email */}
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

            {/* Password */}
            <label htmlFor="login-password">
              Password
            </label>

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

            {/* Remember me และ Forgot Password */}
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

            {/* แสดงข้อผิดพลาด */}
            {error && (
              <p role="alert" style={{ color: '#dc2626' }}>
                {error}
              </p>
            )}

            {/* ปุ่ม Login */}
            <button
              className="primary-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Sign in'}
              <Icon name="chevron" size={18}/>
            </button>

          </form>
        </div>
      </section>

      {/* หน้าต่าง Forgot Password */}
      {resetOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setResetOpen(false)}
        >
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

              <button
                className="icon-btn"
                onClick={() => setResetOpen(false)}
              >
                <Icon name="close"/>
              </button>
            </div>

            {resetSubmitted ? (
              <>
                <p className="muted">
                  Password recovery is not available yet.
                  Please contact your administrator.
                </p>

                <button
                  className="primary-btn"
                  onClick={() => setResetOpen(false)}
                >
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

/* =========================================================
   5. SIDEBAR
   เมนูหลักของเว็บไซต์และรายการ Device
========================================================= */

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
  // ควบคุมการแสดงรายการ Device
  const [showDevices, setShowDevices] = useState(true);

  // สถานะเมนู Profile และ Workspace
  const initials = getInitials(username);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // สร้างปุ่มเมนูหลัก
  const nav = (item: Page, label: string) => (
    <button
      className={`nav-item ${page === item ? 'active' : ''}`}
      onClick={() => setPage(item)}
    >
      <Icon name={item}/>
      <span>{label}</span>
      {item === 'alarm' && <em>3</em>}
    </button>
  );

  return (
    <aside className="sidebar">

      {/* โลโก้ */}
      <div className="logo">
        <div className="brand-mark">
          <Icon name="camera"/>
        </div>
        <span>Sofp <b>vision</b></span>
      </div>

      {/* Workspace selector */}
      <div className="workspace-wrap">
        <button
          className="workspace"
          aria-expanded={workspaceOpen}
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
        >
          <div className="avatar small">SV</div>

          <div>
            <b>Sofp vision HQ</b>
            <span>Main workspace</span>
          </div>

          <Icon name="chevron" size={15}/>
        </button>

        {workspaceOpen && (
          <div className="workspace-menu">
            <b>Sofp vision HQ</b>

            <p>
              {devices.length} devices · {devices.filter(device => device.status === 'Online').length} online
            </p>

            <button onClick={() => {
              setPage('dashboard');
              setWorkspaceOpen(false);
            }}>
              Workspace overview
            </button>

            <button onClick={() => {
              setPage('devices');
              setWorkspaceOpen(false);
            }}>
              Manage devices
            </button>

            <button onClick={() => {
              setPage('devices');
              onAdd();
              setWorkspaceOpen(false);
            }}>
              Add device
            </button>
          </div>
        )}
      </div>

      {/* เมนูนำทาง */}
      <nav>
        <span className="nav-label">OVERVIEW</span>

        {nav('dashboard', 'Dashboard')}

        {/* รายการ Device ใน Sidebar */}
        <div className="device-nav">
          <div className="device-nav-head">
            <button
              className={`nav-item ${page === 'devices' ? 'active' : ''}`}
              onClick={() => {
                setPage('devices');
                setShowDevices(true);
              }}
            >
              <Icon name="devices"/>
              <span>Devices</span>
              <strong>{devices.length}</strong>
            </button>

            <button
              className="hover-add"
              aria-label="Add device"
              onClick={() => {
                setPage('devices');
                onAdd();
              }}
            >
              <Icon name="plus" size={16}/>
            </button>
          </div>

          {showDevices && (
            <div className="device-list">
              {devices.map(device => (
                <button
                  key={device.id}
                  className={
                    page === 'devices' && selectedDevice === device.id
                      ? 'selected-device'
                      : ''
                  }
                  aria-current={
                    page === 'devices' && selectedDevice === device.id
                      ? 'page'
                      : undefined
                  }
                  onClick={() => {
                    setPage('devices');
                    onSelect(device.id);
                  }}
                >
                  <span className={device.status.toLowerCase()}/>

                  <div>
                    <b>{device.name}</b>
                    <small>{device.place}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* เมนู Activity */}
        <span className="nav-label second">ACTIVITY</span>

        {nav('history', 'History')}
        {nav('alarm', 'Alarm')}
      </nav>

      {/* Profile และ Logout */}
      <div className="profile-wrap">
        {profileOpen && (
          <div className="profile-menu">
            <button onClick={onLogout}>
              <Icon name="logout" size={15}/>
              Log out
            </button>
          </div>
        )}

        <button
          className="profile"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <div className="avatar">{initials}</div>

          <div>
            <b>{username}</b>
            <span>{role}</span>
          </div>

          <Icon name="chevron" size={18}/>
        </button>
      </div>

    </aside>
  );
}

/* =========================================================
   6. DASHBOARD
   แสดงสถิติ กล้องล่าสุด และ Recent Events
========================================================= */

function Dashboard({
  devices,
  onSelect,
  username
}: {
  devices: Device[];
  onSelect: (id: string) => void;
  username: string;
}) {
  // คำนวณจำนวน Device ที่ Online
  const online = devices.filter(device =>
    device.status === 'Online' || device.deviceState === 'Active'
  ).length;

  // รวมจำนวนคนที่ตรวจจับได้จากทุก Device
  const people = devices.reduce(
    (total, device) => total + device.people,
    0
  );

  // จำนวน Alarm ที่ยังไม่ได้ Acknowledge
  const [activeAlarmCount, setActiveAlarmCount] = useState(0);

  // Subscribe AlarmLog ของแต่ละ Device
  useEffect(() => {
    const counts = new Map<string, number>();

    const unsubscribers = devices.map(device =>
      onSnapshot(
        collection(db, 'Devices', device.id, 'AlarmLog'),
        snapshot => {
          counts.set(
            device.id,
            snapshot.docs.filter(
              item =>
                item.data().Type !== 'config' &&
                item.data().Status !== true
            ).length
          );

          setActiveAlarmCount(
            Array.from(counts.values()).reduce(
              (sum, count) => sum + count,
              0
            )
          );
        },
        error =>
          console.error(
            `Dashboard alarm listener (${device.id}):`,
            error
          )
      )
    );

    if (devices.length === 0) {
      setActiveAlarmCount(0);
    }

    return () =>
      unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [devices]);

  // ข้อมูล Recent Events
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');

  // Subscribe HistoryLog 4 รายการล่าสุด
  useEffect(() => {
    const logsQuery = query(
      collection(db, 'HistoryLog'),
      orderBy('Time', 'desc'),
      limit(4)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      snapshot => {
        const data = snapshot.docs.map(item => ({
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

  // วันที่ปัจจุบันสำหรับหัว Dashboard
  const today = new Date();

  const dashboardDate = today
    .toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    .toUpperCase();

  // คำนวณเวลาที่ผ่านไปของ Event
  const getRelativeTime = (value: any) => {
    if (!value) return '-';

    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (isNaN(date.getTime())) return '-';

    const seconds = Math.floor(
      (Date.now() - date.getTime()) / 1000
    );

    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} minutes ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 30) {
      return `${days} days ago`;
    }

    return formatLogTime(value);
  };

  return (
    <>

      {/* หัว Dashboard */}
      <div className="page-heading">
        <div>
          <span className="overline">{dashboardDate}</span>

          <h1>Good morning, {username}.</h1>

          <p>
            Here’s what’s happening across your camera network.
          </p>
        </div>
      </div>

      {/* การ์ดสถิติ */}
      <div className="stats-grid">
        {[
          [String(devices.length), 'Total devices', 'Registered cameras', 'devices'],
          [String(online), 'Devices online', `${devices.length ? Math.round(online / devices.length * 100) : 0}% available`, 'camera'],
          [String(people), 'People detected', 'Latest snapshots', 'dashboard'],
          [String(activeAlarmCount), 'Active alarms', 'Needs attention', 'alarm']
        ].map(([n, l, s, i], index) => (
          <article className="stat-card" key={l}>
            <div className={`stat-icon c${index}`}>
              <Icon name={i as IconName}/>
            </div>

            <span>{l}</span>
            <b>{n}</b>
            <small>{s}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">

        {/* ภาพกล้อง Live Overview */}
        <section className="panel camera-panel">
          <div className="panel-head">
            <div>
              <h2>Live overview</h2>
              <p>Latest camera snapshots</p>
            </div>
          </div>

          {devices.length ? (
            <div className="camera-grid">
              {devices.slice(0, 3).map((d, i) => (
                <button
                  className={`feed feed-${i}`}
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    isolation: 'isolate'
                  }}
                >

                  {/* ภาพจาก Backend ผ่าน WebSocket */}
                  <LiveCameraFeed
                    deviceId={d.thingsBoardId || d.id}
                    compact
                  />

                  {/* ข้อมูลสถานะกล้อง */}
                  <div
                    className="feed-top"
                    style={{
                      position: 'relative',
                      zIndex: 2
                    }}
                  >
                    <span>
                      <i/>
                      {d.status === 'Online' ? 'LIVE' : 'UNAVAILABLE'}
                    </span>

                    <b>{d.people} people</b>
                  </div>

                  {/* ชื่อกล้องและตำแหน่ง */}
                  <div
                    className="feed-bottom"
                    style={{
                      position: 'relative',
                      zIndex: 2
                    }}
                  >
                    <b>{d.name}</b>
                    <span>{d.place}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="camera"/>
              <b>No camera data</b>
            </div>
          )}
        </section>

        {/* Recent Events */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent events</h2>
              <p>Showing the latest activity</p>
            </div>
          </div>

          <div className="activity-list">

            {eventsLoading && (
              <div className="empty-state">
                Loading events...
              </div>
            )}

            {eventsError && (
              <div className="empty-state">
                <Icon name="history"/>
                <b>Unable to load events</b>
                <span>{eventsError}</span>
              </div>
            )}

            {!eventsLoading &&
              !eventsError &&
              recentEvents.length === 0 && (
                <div className="empty-state">
                  <Icon name="history"/>
                  <b>No recent events</b>
                  <span>No records found in HistoryLog.</span>
                </div>
              )}

            {!eventsLoading &&
              !eventsError &&
              recentEvents.map(event => {
                const deviceName =
                  event.Device_Name ||
                  event.Device ||
                  event.Camera_Name ||
                  'System';

                const eventName =
                  event.Event ||
                  event.Action ||
                  event.Description ||
                  event.Message ||
                  event.Activity ||
                  'Activity recorded';

                return (
                  <div key={event.id}>
                    <i className="event blue">
                      <Icon name="history" size={17}/>
                    </i>

                    <p>
                      <b>{eventName}</b>

                      <span>
                        {deviceName} · {getRelativeTime(event.Time)}
                      </span>
                    </p>

                    <span className="event-state">
                      Recorded
                    </span>
                  </div>
                );
              })}

          </div>
        </section>
      </div>
    </>
  );
}

/* =========================================================
   7. DEVICES PAGE
   แสดงรายการกล้อง ค้นหา กรองสถานะ และภาพจาก Backend
========================================================= */

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
  // ตัวกรองสถานะ Device
  const [status, setStatus] = useState('All');

  // กรอง Device ตามสถานะและคำค้นหา
  const filtered = devices.filter(device =>
    (status === 'All' || device.status === status) &&
    `${device.name} ${device.place}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <>

      {/* หัวหน้า Devices */}
      <div className="page-heading">
        <div>
          <span className="overline">DEVICE MANAGEMENT</span>

          <h1>
            Devices <span className="title-count">{filtered.length}</span>
          </h1>

          <p>
            Monitor and manage every camera in your network.
          </p>
        </div>

        <button
          className="primary-btn compact"
          onClick={onAdd}
        >
          <Icon name="plus" size={18}/>
          Add device
        </button>
      </div>

      {/* ช่องค้นหาและกรองสถานะ */}
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18}/>

          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name or location..."
          />
        </div>

        <select
          className="status-select"
          value={status}
          onChange={event => setStatus(event.target.value)}
        >
          <option value="All">All status</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select>
      </div>

      {/* รายการ Device */}
      {filtered.length ? (
        <div className="device-cards">
          {filtered.map((device, i) => (
            <article
              className="device-card"
              key={device.id}
              onClick={() => onSelect(device.id)}
            >

              {/* ภาพ Preview จาก WebSocket */}
              <div
                className={`device-preview preview-${i}`}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  isolation: 'isolate'
                }}
              >
                <LiveCameraFeed
                  deviceId={device.thingsBoardId || device.id}
                  compact
                />

                {/* ป้ายสถานะ */}
                <span
                  className={`status-pill ${device.status.toLowerCase()}`}
                  style={{
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <i/>
                  {device.status}
                </span>
              </div>

              {/* รายละเอียด Device */}
              <div className="device-info">
                <div>
                  <h3>{device.name}</h3>
                  <p>{device.place}</p>
                </div>

                <button aria-label={`View ${device.name}`}>
                  <Icon name="chevron" size={18}/>
                </button>

                {/* ข้อมูลสรุป */}
                <dl>
                  <div>
                    <dt>People</dt>
                    <dd>{device.people}</dd>
                  </div>

                  <div>
                    <dt>Uptime</dt>
                    <dd>{device.status === 'Online' ? '99.8%' : '—'}</dd>
                  </div>

                  <div>
                    <dt>Quality</dt>
                    <dd>{device.status === 'Online' ? '1080p' : '—'}</dd>
                  </div>
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

/* =========================================================
   8. DEVICE TELEMETRY CHART
   กราฟแสดงข้อมูลย้อนหลัง Battery, RSSI, Temperature และ People
========================================================= */

function DeviceTelemetryChart({
  deviceId
}: {
  deviceId: string;
}) {
  // ข้อมูล Telemetry จาก Firestore
  const [rows, setRows] = useState<any[]>([]);

  // ค่าที่ต้องการแสดงในกราฟ
  const [metric, setMetric] = useState<
    'Battery' | 'RSSI' | 'Temperature' | 'People'
  >('Battery');

  // ช่วงเวลาที่ต้องการดู
  const [range, setRange] = useState('24');

  // สถานะโหลดและข้อผิดพลาด
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // จุดที่เมาส์กำลังชี้อยู่บนกราฟ
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Subscribe TelemetryHistory ของ Device
  useEffect(() => {
    setLoading(true);
    setError('');

    const historyQuery = query(
      collection(db, 'Devices', deviceId, 'TelemetryHistory'),
      orderBy('CreatedAt', 'desc'),
      limit(1000)
    );

    const unsubscribe = onSnapshot(
      historyQuery,
      snapshot => {
        const data = snapshot.docs
          .filter(item => item.data().Type !== 'config')
          .map(item => ({
            id: item.id,
            ...item.data()
          }));

        setRows(data);
        setLoading(false);
      },
      err => {
        console.error('TelemetryHistory error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [deviceId]);

  // กรองข้อมูลตามช่วงเวลาที่เลือก
  const cutoff = Date.now() - Number(range) * 60 * 60 * 1000;

  const points = rows
    .map(row => ({
      ...row,
      date: toDate(row.CreatedAt)
    }))
    .filter(row =>
      row.date &&
      row.date.getTime() >= cutoff &&
      row[metric] !== null &&
      row[metric] !== undefined &&
      Number.isFinite(Number(row[metric]))
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // คำนวณค่าต่ำสุดและสูงสุดของกราฟ
  const values = points.map(row => Number(row[metric]));

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const spread = max - min || 1;

  // หน่วยของข้อมูล
  const unit =
    metric === 'Battery'
      ? '%'
      : metric === 'RSSI'
        ? ' dBm'
        : metric === 'Temperature'
          ? '°C'
          : ' people';

  return (
    <section className="panel telemetry-panel">

      {/* หัวกราฟและตัวเลือก */}
      <div className="panel-head">
        <div>
          <h2>Telemetry history</h2>
          <p>{metric} · Recorded every 5 minutes</p>
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          <select
            className="status-select"
            value={metric}
            onChange={e => setMetric(e.target.value as any)}
          >
            <option value="Battery">Battery (%)</option>
            <option value="RSSI">Signal · RSSI (dBm)</option>
            <option value="Temperature">Temperature (°C)</option>
            <option value="People">People</option>
          </select>

          <select
            className="status-select"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            <option value="1">Last 1 hour</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
            <option value="720">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* สถานะการโหลดข้อมูล */}
      {loading ? (
        <div className="empty-state">
          Loading telemetry...
        </div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#dc2626' }}>
          {error}
        </div>
      ) : points.length === 0 ? (
        <div className="empty-state">
          <b>No telemetry history yet</b>
          <span>
            Backend will add a snapshot every 5 minutes.
          </span>
        </div>
      ) : (
        <>

          {/* ค่าสรุปของข้อมูล */}
          <div style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            margin: '8px 0 12px'
          }}>
            <b>
              {values[values.length - 1]}{unit}
            </b>

            <span className="muted">
              Min: {min}{unit} · Max: {max}{unit}
            </span>

            <span className="muted">
              {points.length} samples
            </span>
          </div>

          {/* พื้นที่กราฟ */}
          <div
            style={{
              position: 'relative',
              width: '100%'
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <svg
              viewBox="0 0 700 220"
              role="img"
              aria-label={`${metric} telemetry chart`}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                minHeight: 180,
                overflow: 'visible'
              }}
            >

              {/* เส้น Grid */}
              {[35, 83, 131, 180].map(y => (
                <line
                  key={y}
                  x1="24"
                  y1={y}
                  x2="676"
                  y2={y}
                  stroke="currentColor"
                  opacity="0.12"
                />
              ))}

              {/* เส้นกราฟ */}
              {values.length > 1 && (
                <polyline
                  points={values.map((value, index) => {
                    const x =
                      values.length <= 1
                        ? 350
                        : 24 + index * 652 / (values.length - 1);

                    const y =
                      180 - ((value - min) / spread) * 145;

                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#399b78"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* จุดข้อมูลบนกราฟ */}
              {values.map((value, index) => {
                const x =
                  values.length <= 1
                    ? 350
                    : 24 + index * 652 / (values.length - 1);

                const y =
                  180 - ((value - min) / spread) * 145;

                const active = hoveredIndex === index;

                return (
                  <g
                    key={points[index].id}
                    onMouseEnter={() => setHoveredIndex(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r="13"
                      fill="transparent"
                    />

                    {active && (
                      <circle
                        cx={x}
                        cy={y}
                        r="7.5"
                        fill="#399b78"
                        stroke="#d9f36a"
                        strokeWidth="3"
                      />
                    )}

                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 4.5 : 5}
                      fill="#399b78"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

              {/* เวลาเริ่มต้นและสิ้นสุด */}
              <text
                x="24"
                y="210"
                fontSize="11"
                fill="currentColor"
                opacity="0.65"
              >
                {points[0].date.toLocaleString()}
              </text>

              <text
                x="676"
                y="210"
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
                opacity="0.65"
              >
                {points[points.length - 1].date.toLocaleString()}
              </text>

            </svg>

            {/* Tooltip เมื่อชี้บนจุดกราฟ */}
            {hoveredIndex !== null &&
              points[hoveredIndex] &&
              (() => {
                const point = points[hoveredIndex];

                const x =
                  values.length <= 1
                    ? 350
                    : 24 + hoveredIndex * 652 / (values.length - 1);

                const y =
                  180 - ((values[hoveredIndex] - min) / spread) * 145;

                const dateLabel = point.date.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });

                const tooltipRows = [
                  ['Battery', point.Battery, '%'],
                  ['RSSI', point.RSSI, ' dBm']
                ].filter(([, value]) =>
                  value !== null &&
                  value !== undefined &&
                  Number.isFinite(Number(value))
                );

                if (tooltipRows.length === 0) {
                  tooltipRows.push([
                    metric,
                    point[metric],
                    unit
                  ]);
                }

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
                    <div style={{
                      fontWeight: 700,
                      marginBottom: 3
                    }}>
                      {dateLabel}
                    </div>

                    {tooltipRows.map(([label, value, suffix]) => (
                      <div key={String(label)}>
                        {label}: {value}{suffix}
                      </div>
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

/* =========================================================
   9. DEVICE PEOPLE LOG
   แสดงประวัติการเปลี่ยนแปลงจำนวนคนที่ตรวจจับได้
========================================================= */

function DevicePeopleLog({
  deviceId
}: {
  deviceId: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe PeopleLog ของ Device
  useEffect(() => {
    const q = query(
      collection(db, 'Devices', deviceId, 'PeopleLog'),
      orderBy('Time', 'desc'),
      limit(100)
    );

    return onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs
            .filter(d => d.data().Type !== 'config')
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
        );

        setLoading(false);
      },
      err => {
        console.error('PeopleLog error:', err);
        setLoading(false);
      }
    );
  }, [deviceId]);

  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <div>
          <h2>People count changes</h2>
          <p>
            Recorded only when the detected count changes
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          Loading people history...
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <b>No people count changes</b>
        </div>
      ) : (
        <div className="event-table">

          {/* หัวตาราง */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr .7fr',
            padding: 12,
            background: '#f4f6f5',
            borderRadius: 8,
            fontSize: 12
          }}>
            <span>Time</span>
            <span>Previous</span>
            <span>Current</span>
            <span>Change</span>
          </div>

          {/* ข้อมูลแต่ละรายการ */}
          {rows.map(row => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr .7fr',
                alignItems: 'center',
                padding: '14px 12px',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 13
              }}
            >
              <span>{formatLogTime(row.Time)}</span>

              <span>
                {Number(row.Previous ?? 0)} people
              </span>

              <b>
                {Number(row.Current ?? 0)} people
              </b>

              <span style={{
                fontWeight: 600,
                color: Number(row.Change) >= 0
                  ? '#16845b'
                  : '#c64d45'
              }}>
                {Number(row.Change) > 0 ? '+' : ''}
                {Number(row.Change ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   10. DEVICE ALARM LOG
   แสดง Alarm ของ Device และเปลี่ยนสถานะ Acknowledge
========================================================= */

function DeviceAlarmLog({
  deviceId
}: {
  deviceId: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe AlarmLog ของ Device
  useEffect(() => {
    const q = query(
      collection(db, 'Devices', deviceId, 'AlarmLog'),
      orderBy('CreatedAt', 'desc'),
      limit(100)
    );

    return onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs
            .filter(d => d.data().Type !== 'config')
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
        );

        setLoading(false);
      },
      err => {
        console.error('AlarmLog error:', err);
        setLoading(false);
      }
    );
  }, [deviceId]);

  // เปลี่ยนสถานะ Alarm
  const toggleStatus = async (row: any) => {
    setUpdating(current => [...current, row.id]);

    try {
      // true = Acknowledged
      // false = ยังไม่ Acknowledge
      await updateDoc(
        doc(db, 'Devices', deviceId, 'AlarmLog', row.id),
        {
          Status: row.Status !== true
        }
      );
    } catch (err) {
      console.error('Update device alarm failed:', err);
    } finally {
      setUpdating(current =>
        current.filter(id => id !== row.id)
      );
    }
  };

  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <div>
          <h2>Alarm history</h2>
          <p>
            Device alerts and acknowledgement status
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          Loading alarms...
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <b>No alarms recorded</b>
        </div>
      ) : (
        <div className="event-table">
          {rows.map(row => (
            <div key={row.id}>
              <i className="event orange">
                <Icon name="alarm" size={18}/>
              </i>

              <p>
                <b>{row.Event || 'Device alert'}</b>

                <span>
                  Time: {formatLogTime(row.CreatedAt)}
                </span>

                <span>
                  Signal: {row.Signal ?? '-'}
                </span>

                <span>
                  Battery: {row.Battery ?? '-'}
                </span>
              </p>

              <button
                className={`event-state actionable ${
                  row.Status === true ? 'acknowledged' : ''
                }`}
                disabled={updating.includes(row.id)}
                onClick={() => toggleStatus(row)}
              >
                {updating.includes(row.id)
                  ? 'Updating...'
                  : row.Status === true
                    ? 'Acknowledged'
                    : 'Acknowledge'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   11. LIVE CAMERA FEED
   รับภาพ JPEG จาก Backend ผ่าน WebSocket

   compact = true:
   ใช้ใน Dashboard และหน้า Devices

   compact = false:
   ใช้ในหน้า Device Detail

   Backend:
   /ws/live/{device_id}

   Firebase:
   SystemConfig/backend
   wsUrl = WebSocket URL หลัก เช่น
   wss://example.trycloudflare.com/ws/live
========================================================= */

function LiveCameraFeed({
  deviceId,
  compact = false
}: {
  deviceId: string;
  compact?: boolean;
}) {
  // WebSocket URL ที่อ่านจาก Firebase
  const [wsBaseUrl, setWsBaseUrl] = useState('');

  // URL ของภาพที่ได้รับจาก Backend
  const [imageUrl, setImageUrl] = useState('');

  // สถานะการเชื่อมต่อ
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // เก็บ Object URL ปัจจุบันไว้เพื่อ revoke เมื่อมีภาพใหม่
  const imageUrlRef = useRef<string | null>(null);

  // อ่าน WebSocket URL ล่าสุดจาก Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'SystemConfig', 'backend'),
      snapshot => {
        const data = snapshot.data();

        if (data?.wsUrl) {
          setWsBaseUrl(data.wsUrl);
        } else {
          setWsBaseUrl('');
        }
      },
      error => {
        console.error('Backend config error:', error);
        setConnectionStatus('Backend unavailable');
      }
    );

    return () => unsubscribe();
  }, []);

  // เชื่อมต่อ WebSocket และรับภาพจาก Backend
  useEffect(() => {
    // ยังไม่มี URL หรือ Device ID
    if (!wsBaseUrl || !deviceId) {
      setConnectionStatus('Waiting for backend...');
      return;
    }

    let socket: WebSocket | null = null;

    // Timer สำหรับเชื่อมต่อใหม่เมื่อ WebSocket หลุด
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // ป้องกันการ reconnect หลัง Component ถูกถอดออก
    let stopped = false;

    // ฟังก์ชันเชื่อมต่อ WebSocket
    const connect = () => {
      if (stopped) return;

      // Backend endpoint คือ /ws/live/{device_id}
      const url =
        `${wsBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(deviceId)}`;

      setConnectionStatus('Connecting...');

      try {
        socket = new WebSocket(url);

        // รับข้อมูลภาพเป็น Blob
        socket.binaryType = 'blob';

        // เมื่อเชื่อมต่อสำเร็จ
        socket.onopen = () => {
          setConnectionStatus('LIVE');

          console.log(
            '[Camera] Connected:',
            deviceId
          );
        };

        // เมื่อได้รับข้อมูลจาก Backend
        socket.onmessage = event => {

          // Backend ส่ง JSON metadata แยกจากภาพ JPEG
          if (typeof event.data === 'string') {
            try {
              const metadata = JSON.parse(event.data);

              console.log(
                '[Camera] Metadata:',
                metadata
              );
            } catch {
              console.log(
                '[Camera] Message:',
                event.data
              );
            }

            return;
          }

          // กรณีได้รับภาพเป็น Blob
          if (event.data instanceof Blob) {
            const nextUrl = URL.createObjectURL(event.data);

            // ลบ URL ภาพเก่าเพื่อคืนหน่วยความจำ
            if (imageUrlRef.current) {
              URL.revokeObjectURL(imageUrlRef.current);
            }

            imageUrlRef.current = nextUrl;

            setImageUrl(nextUrl);
            setConnectionStatus('LIVE');

            return;
          }

          // กรณีได้รับภาพเป็น ArrayBuffer
          if (event.data instanceof ArrayBuffer) {
            const nextUrl = URL.createObjectURL(
              new Blob(
                [event.data],
                { type: 'image/jpeg' }
              )
            );

            // ลบ URL ภาพเก่า
            if (imageUrlRef.current) {
              URL.revokeObjectURL(imageUrlRef.current);
            }

            imageUrlRef.current = nextUrl;

            setImageUrl(nextUrl);
            setConnectionStatus('LIVE');
          }
        };

        // เมื่อเกิดข้อผิดพลาดของ WebSocket
        socket.onerror = error => {
          console.error(
            '[Camera] WebSocket error:',
            error
          );
        };

        // เมื่อ WebSocket ถูกตัดการเชื่อมต่อ
        socket.onclose = () => {
          if (stopped) return;

          setConnectionStatus('Reconnecting...');

          // ลองเชื่อมต่อใหม่ทุก 3 วินาที
          reconnectTimer = setTimeout(
            connect,
            3000
          );
        };

      } catch (error) {
        console.error(
          '[Camera] Connection failed:',
          error
        );

        setConnectionStatus('Connection failed');

        // กรณีสร้าง WebSocket ไม่สำเร็จ ให้ลองใหม่
        reconnectTimer = setTimeout(
          connect,
          3000
        );
      }
    };

    // เริ่มเชื่อมต่อ
    connect();

    // Cleanup เมื่อเปลี่ยน Device หรือ Component ถูกถอดออก
    return () => {
      stopped = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socket) {
        socket.onclose = null;
        socket.close();
      }

      // คืนหน่วยความจำของภาพล่าสุด
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }

      setImageUrl('');
    };
  }, [wsBaseUrl, deviceId]);

  // Style สำหรับรูปแบบ Compact
  // ใช้กับภาพ Preview บน Dashboard และ Devices
  const compactContainerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    minHeight: 0,
    background: '#101817',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0
  };

  // Style สำหรับรูปแบบ Detail
  // ใช้ในหน้า Device Detail
  const detailContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: 280,
    background: '#101817',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  // รูปแบบการแสดงผลของภาพ
  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: compact ? 'cover' : 'contain'
  };

  // ข้อความเมื่อยังไม่มีภาพ
  const placeholder = (
    <div style={{
      color: '#9ca3af',
      textAlign: 'center',
      padding: 24,
      zIndex: 1
    }}>
      <Icon
        name="camera"
        size={compact ? 32 : 42}
      />

      <p>No camera image</p>

      <small>{connectionStatus}</small>
    </div>
  );

  // Compact mode สำหรับ Dashboard และ Devices
  if (compact) {
    return (
      <div
        className="camera-feed-compact"
        style={compactContainerStyle}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Live camera ${deviceId}`}
            style={imageStyle}
          />
        ) : (
          placeholder
        )}
      </div>
    );
  }

  // Detail mode สำหรับหน้า Device Detail
  return (
    <div
      className="detail-feed"
      style={detailContainerStyle}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Live camera ${deviceId}`}
          style={imageStyle}
        />
      ) : (
        placeholder
      )}

      {/* สถานะการเชื่อมต่อ */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(0,0,0,.7)',
        color: '#fff',
        fontSize: 11
      }}>
        <i style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: connectionStatus === 'LIVE'
            ? '#22c55e'
            : '#f59e0b'
        }}/>

        {connectionStatus}
      </div>
    </div>
  );
}

/* =========================================================
   12. DEVICE DETAIL
   รายละเอียดกล้อง สถานะ Telemetry ภาพ Live และ Logs
========================================================= */

function DeviceDetail({
  id,
  onBack,
  onEdit,
  devices
}: {
  id: string;
  onBack: () => void;
  onEdit: () => void;
  devices: Device[];
}) {
  // ค้นหา Device ที่ผู้ใช้เลือก
  const device = devices.find(item => item.id === id);

  // กรณีไม่พบ Device
  if (!device) {
    return (
      <div className="empty-state">
        <Icon name="camera"/>
        <b>Device not found</b>

        <button
          className="outline-btn"
          onClick={onBack}
        >
          Back to devices
        </button>
      </div>
    );
  }

  // ข้อมูล Telemetry ล่าสุด
  const battery = device.battery;
  const rssi = device.rssi;
  const state = device.deviceState || device.status;

  // ประเมินคุณภาพสัญญาณจาก RSSI
  const signalQuality =
    rssi === null
      ? 'No signal data'
      : rssi >= -60
        ? 'Excellent connection'
        : rssi >= -75
          ? 'Good connection'
          : 'Weak connection';

  return (
    <>

      {/* ปุ่มย้อนกลับ */}
      <button
        className="back-btn"
        onClick={onBack}
      >
        ‹ All devices
      </button>

      {/* หัวข้อ Device Detail */}
      <div className="page-heading detail-heading">
        <div>
          <span className="overline">DEVICE DETAIL</span>
          <h1>{device.name}</h1>
          <p>{device.place}</p>
        </div>

        <div className="detail-actions">
          <span className={`detail-status ${state.toLowerCase()}`}>
            <i/>
            {state}
          </span>

          <button
            className="outline-btn"
            onClick={onEdit}
          >
            Edit device
          </button>
        </div>
      </div>

      <div className="detail-layout">

        <div className="detail-left">

          {/* การ์ดข้อมูล Telemetry ล่าสุด */}
          <div className="device-metrics">

            <article>
              <span>BATTERY</span>

              <b>
                {battery === null ? '—' : battery}
                <small>
                  {battery === null ? '' : '%'}
                </small>
              </b>

              <p>
                {battery === null
                  ? 'Waiting for telemetry'
                  : 'Latest reported value'}
              </p>
            </article>

            <article>
              <span>SIGNAL · RSSI</span>

              <b>
                {rssi === null ? '—' : rssi}
                <small>
                  {rssi === null ? '' : ' dBm'}
                </small>
              </b>

              <p>{signalQuality}</p>
            </article>

            <article>
              <span>DEVICE STATE</span>

              <b className={
                state.toLowerCase() === 'active' ||
                state.toLowerCase() === 'online'
                  ? 'active-text'
                  : ''
              }>
                {state}
              </b>

              <p>Latest reported state</p>
            </article>

          </div>

          {/* กราฟ Telemetry */}
          <DeviceTelemetryChart deviceId={id}/>

        </div>

        {/* ภาพกล้อง Live */}
        <section className="panel live-detail">
          <div className="panel-head">
            <div>
              <h2>Live camera</h2>
              <p>Real-time camera feed · OpenCV / YOLO</p>
            </div>

            <span className="live-badge">
              <i/>LIVE
            </span>
          </div>

          <LiveCameraFeed
            deviceId={device.thingsBoardId || device.id}
          />

          {/* ข้อมูลเพิ่มเติมใต้ภาพ */}
          <div
            className="feed-data"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px'
            }}
          >
            <span>
              {device.people} people detected
            </span>

            <b>
              {device.temperature === null
                ? '—'
                : `${device.temperature} °C`}
            </b>
          </div>
        </section>

      </div>

      {/* ประวัติ People Count */}
      <DevicePeopleLog deviceId={id}/>

      {/* ประวัติ Alarm */}
      <DeviceAlarmLog deviceId={id}/>

    </>
  );
}

/* =========================================================
   13. HISTORY AND ALARM PAGE
   แสดงประวัติระบบและ Security Log
========================================================= */

function SimplePage({
  page,
  devices
}: {
  page: 'history' | 'alarm';
  devices: Device[];
}) {
  // ตรวจสอบว่าหน้าปัจจุบันเป็น Alarm หรือ History
  const alarm = page === 'alarm';

  // ตัวกรองวันที่
  const [filter, setFilter] = useState('All');

  // ข้อมูล Log
  const [rows, setRows] = useState<any[]>([]);

  // สถานะโหลดและข้อผิดพลาด
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // รายการที่กำลังอัปเดต
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  // เลือก Collection ตามหน้า
  const collectionName = alarm
    ? 'SecurityLog'
    : 'HistoryLog';

  // Subscribe Log จาก Firestore
  useEffect(() => {
    setLoading(true);
    setError('');

    const logsQuery = query(
      collection(db, collectionName),
      orderBy('Time', 'desc')
    );

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

  // เปลี่ยนสถานะ Acknowledge ของ Alarm
  const acknowledgeAlarm = async (rowId: string) => {
    if (!alarm) return;

    const currentRow = rows.find(row => row.id === rowId);

    if (!currentRow) return;

    setUpdatingIds(current => [...current, rowId]);

    try {
      await updateDoc(
        doc(db, 'SecurityLog', rowId),
        {
          Status: currentRow.Status !== true
        }
      );
    } catch (err: any) {
      console.error('Update alarm error:', err);

      setError(
        `ไม่สามารถอัปเดต Alarm ได้: ${err.message}`
      );
    } finally {
      setUpdatingIds(current =>
        current.filter(id => id !== rowId)
      );
    }
  };

  // กรองข้อมูลตามวันที่
  const filteredRows = rows.filter(row => {
    if (filter === 'All') return true;

    const date = row.Time?.toDate
      ? row.Time.toDate()
      : new Date(row.Time);

    if (isNaN(date.getTime())) return false;

    const now = new Date();

    if (filter === 'Today') {
      return date.toDateString() === now.toDateString();
    }

    if (filter === 'Last 7 days') {
      const sevenDaysAgo = new Date();

      sevenDaysAgo.setDate(
        now.getDate() - 7
      );

      return date >= sevenDaysAgo && date <= now;
    }

    return true;
  });

  // จำนวน Alarm ที่ยังไม่ Acknowledge
  const unresolvedAlarms = rows.filter(
    row => row.Status === false
  ).length;

  return (
    <>

      {/* หัวข้อหน้า */}
      <div className="page-heading">
        <div>
          <span className="overline">
            {alarm ? 'SECURITY CENTER' : 'EVENT LOG'}
          </span>

          <h1>
            {alarm ? 'Alarm' : 'History'}
          </h1>

          <p>
            {alarm
              ? 'Review events that need your attention.'
              : 'Browse camera and system activity across your network.'}
          </p>
        </div>
      </div>

      {/* ตารางข้อมูล */}
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>
              {alarm ? 'Security logs' : 'Recent events'}
            </h2>

            <p>
              {loading
                ? 'Loading data...'
                : alarm
                  ? `${unresolvedAlarms} unresolved alarms`
                  : `${filteredRows.length} records found`}
            </p>
          </div>

          {/* ตัวกรองช่วงเวลา */}
          <select
            className="status-select"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            <option value="All">All</option>
            <option value="Today">Today</option>
            <option value="Last 7 days">Last 7 days</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="empty-state">
            Loading logs...
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="empty-state"
            style={{ color: '#dc2626' }}
          >
            {error}
          </div>
        )}

        {/* ไม่มีข้อมูล */}
        {!loading &&
          !error &&
          filteredRows.length === 0 && (
            <div className="empty-state">
              <Icon name="history" size={28}/>
              <b>No records found</b>
              <span>There are no logs to display.</span>
            </div>
          )}

        {/* รายการ Log */}
        {!loading &&
          !error &&
          filteredRows.length > 0 && (
            <div className="event-table">
              {filteredRows.map(row => {
                const acknowledged = row.Status === true;
                const updating = updatingIds.includes(row.id);

                return (
                  <div key={row.id}>
                    <i className={`event ${alarm ? 'orange' : 'blue'}`}>
                      <Icon
                        name={alarm ? 'alarm' : 'history'}
                        size={18}
                      />
                    </i>

                    <p>
                      <b>
                        {row.Device_Name || row.id}
                      </b>

                      <span>
                        Time: {formatLogTime(row.Time)}
                      </span>

                      <span>
                        Signal: {row.Signal ?? '-'}
                      </span>

                      <span>
                        Battery: {row.Battery ?? '-'}
                      </span>
                    </p>

                    {/* ปุ่ม Acknowledge แสดงเฉพาะ Alarm */}
                    {alarm ? (
                      <button
                        className={`event-state actionable ${
                          acknowledged ? 'acknowledged' : ''
                        }`}
                        disabled={updating}
                        onClick={() => acknowledgeAlarm(row.id)}
                      >
                        {updating
                          ? 'Updating...'
                          : acknowledged
                            ? 'Acknowledged'
                            : 'Acknowledge'}
                      </button>
                    ) : (
                      <span className="event-state">
                        Recorded
                      </span>
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

/* =========================================================
   14. DEVICE DUPLICATE VALIDATION
   ตรวจสอบชื่อ Device และ ThingsBoard ID ซ้ำ
========================================================= */

// ปรับข้อความให้เป็นรูปแบบเดียวกันก่อนเปรียบเทียบ
const normalizeDeviceValue = (value: string) =>
  value.trim().toLowerCase();

// ตรวจสอบ Device ที่มีอยู่ใน Firestore
async function checkDeviceDuplicate(
  name: string,
  thingsBoardId: string,
  excludeId?: string
) {
  const snapshot = await getDocs(
    collection(db, 'Devices')
  );

  const normalizedName = normalizeDeviceValue(name);
  const normalizedTbId = normalizeDeviceValue(thingsBoardId);

  for (const item of snapshot.docs) {
    // ข้าม Device ปัจจุบันเมื่อกำลังแก้ไขข้อมูล
    if (excludeId && item.id === excludeId) {
      continue;
    }

    const data = item.data();

    const existingName = normalizeDeviceValue(
      data.Name || ''
    );

    const existingTbId = normalizeDeviceValue(
      data.ThingsBoardId || ''
    );

    if (
      existingName &&
      existingName === normalizedName
    ) {
      throw new Error('Device name already exists.');
    }

    if (
      existingTbId &&
      existingTbId === normalizedTbId
    ) {
      throw new Error('ThingsBoard Device ID already exists.');
    }
  }
}

/* =========================================================
   15. CREATE DEVICE
   เพิ่ม Device ใหม่ลง Firestore
========================================================= */

async function createDevice(
  name: string,
  location: string,
  thingsBoardId: string
) {
  // ทำความสะอาดข้อมูลก่อนบันทึก
  const cleanName = name.trim();
  const cleanLocation = location.trim();
  const cleanTbId = thingsBoardId.trim();

  // ตรวจสอบข้อมูลว่าง
  if (!cleanName || !cleanLocation || !cleanTbId) {
    throw new Error('Please fill in all fields.');
  }

  // ตรวจสอบข้อมูลซ้ำ
  await checkDeviceDuplicate(
    cleanName,
    cleanTbId
  );

  // สร้าง Device ใน Collection หลัก
  const docRef = await addDoc(
    collection(db, 'Devices'),
    {
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
    }
  );

  // สร้าง Config สำหรับ Subcollection
  // Config ไม่ใช่ Log จริง จึงกรองออกจากหน้าประวัติ
  const config = {
    Type: 'config',
    CreatedAt: serverTimestamp(),
    Retention: 'backend-managed'
  };

  // สร้าง Subcollection ที่ Backend ใช้งาน
  await Promise.all([
    setDoc(
      doc(db, 'Devices', docRef.id, 'PeopleLog', '_config'),
      {
        ...config,
        Collection: 'PeopleLog'
      }
    ),

    setDoc(
      doc(db, 'Devices', docRef.id, 'AlarmLog', '_config'),
      {
        ...config,
        Collection: 'AlarmLog'
      }
    ),

    setDoc(
      doc(db, 'Devices', docRef.id, 'TelemetryHistory', '_config'),
      {
        ...config,
        Collection: 'TelemetryHistory',
        IntervalMinutes: 5,
        Fields: [
          'Battery',
          'RSSI',
          'Temperature',
          'People'
        ]
      }
    )
  ]);

  return docRef.id;
}

/* =========================================================
   16. UPDATE DEVICE
   แก้ไขข้อมูล Device ใน Firestore
========================================================= */

async function saveDevice(
  deviceId: string,
  name: string,
  location: string,
  thingsBoardId: string
) {
  // ทำความสะอาดข้อมูล
  const cleanName = name.trim();
  const cleanLocation = location.trim();
  const cleanTbId = thingsBoardId.trim();

  // ตรวจสอบข้อมูลว่าง
  if (!cleanName || !cleanLocation || !cleanTbId) {
    throw new Error('Please fill in all fields.');
  }

  // ตรวจสอบข้อมูลซ้ำ โดยไม่ตรวจ Device ตัวเอง
  await checkDeviceDuplicate(
    cleanName,
    cleanTbId,
    deviceId
  );

  // อัปเดตข้อมูล Device
  await updateDoc(
    doc(db, 'Devices', deviceId),
    {
      Name: cleanName,
      Location: cleanLocation,
      ThingsBoardId: cleanTbId
    }
  );
}

/* =========================================================
   17. MAIN APP
   ควบคุมการทำงานหลักของเว็บไซต์
========================================================= */

export default function App() {
  // สถานะ Login
  const [loggedIn, setLoggedIn] = useState(false);

  // ข้อมูลผู้ใช้ที่ Login สำเร็จ
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
  } | null>(null);

  // อักษรย่อสำหรับ Avatar
  const userInitials = getInitials(
    currentUser?.username || 'User'
  );

  // หน้าปัจจุบัน
  const [page, setPage] = useState<Page>('dashboard');

  // สถานะ Modal
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Device ที่กำลังเลือก
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // สถานะ Notification
  const [alertsOpen, setAlertsOpen] = useState(false);

  // ข้อมูล Device จาก Firebase
  const [devices, setDevices] = useState<Device[]>([]);

  // คำค้นหา Device
  const [deviceQuery, setDeviceQuery] = useState('');

  // สถานะโหลด Device
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceError, setDeviceError] = useState('');

  /* -------------------------------------------------------
     17.1 LOAD DEVICES
     โหลดข้อมูล Device จาก Firestore แบบ Real-time
  ------------------------------------------------------- */

  useEffect(() => {
    // ถ้ายังไม่ได้ Login ให้ล้างข้อมูล Device
    if (!loggedIn) {
      setDevices([]);
      setDevicesLoading(false);
      return;
    }

    setDevicesLoading(true);
    setDeviceError('');

    // Subscribe Collection Devices
    const unsubscribe = onSnapshot(
      collection(db, 'Devices'),
      snapshot => {
        // แปลง Firestore Document เป็น Device Type
        const data: Device[] = snapshot.docs.map(item => {
          const deviceData = item.data();

          return {
            id: item.id,

            name: deviceData.Name || '',

            place: deviceData.Location || '',

            thingsBoardId: deviceData.ThingsBoardId || '',

            status: deviceData.Status || 'Offline',

            people: Number(deviceData.People ?? 0),

            battery:
              deviceData.Battery === null ||
              deviceData.Battery === undefined
                ? null
                : Number(deviceData.Battery),

            rssi:
              deviceData.RSSI === null ||
              deviceData.RSSI === undefined
                ? null
                : Number(deviceData.RSSI),

            temperature:
              deviceData.Temperature === null ||
              deviceData.Temperature === undefined
                ? null
                : Number(deviceData.Temperature),

            deviceState:
              deviceData.DeviceState ||
              deviceData.Status ||
              'Inactive'
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

  /* -------------------------------------------------------
     17.2 LOGIN CHECK
     แสดงหน้า Login เมื่อยังไม่ได้เข้าสู่ระบบ
  ------------------------------------------------------- */

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

  // Device ที่กำลังเปิดรายละเอียด
  const activeDevice = devices.find(
    device => device.id === selectedDevice
  );

  /* -------------------------------------------------------
     17.3 ADD DEVICE HANDLER
     รับข้อมูลจาก Add Device Modal
  ------------------------------------------------------- */

  const handleAddDevice = async (
    event: FormEvent<HTMLFormElement>
  ) => {
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

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to add device.'
      );
    }
  };

  /* -------------------------------------------------------
     17.4 EDIT DEVICE HANDLER
     รับข้อมูลจาก Edit Device Modal
  ------------------------------------------------------- */

  const handleEditDevice = async (
    event: FormEvent<HTMLFormElement>
  ) => {
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

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to update device.'
      );
    }
  };

  /* =======================================================
     18. MAIN APP LAYOUT
     โครงสร้าง Sidebar, Header, Content และ Modal
  ======================================================= */

  return (
    <div className="app-shell">

      {/* ---------------------------------------------------
         18.1 SIDEBAR
         เมนูนำทางด้านซ้าย
      --------------------------------------------------- */}

      <Sidebar
        selectedDevice={selectedDevice}
        devices={devices}
        page={page}
        username={currentUser?.username || 'User'}
        role={currentUser?.role || 'User'}

        // เปลี่ยนหน้าและยกเลิก Device ที่เลือก
        setPage={next => {
          setPage(next);
          setSelectedDevice(null);
        }}

        // Logout
        onLogout={() => {
          setLoggedIn(false);
          setCurrentUser(null);
          setSelectedDevice(null);
        }}

        // เปิด Add Device
        onAdd={() => setAddOpen(true)}

        // เลือก Device
        onSelect={id => {
          setSelectedDevice(id);
          setPage('devices');
        }}
      />

      {/* ---------------------------------------------------
         18.2 MAIN CONTENT
         ส่วนหลักของเว็บไซต์
      --------------------------------------------------- */}

      <main className="app-main">

        {/* Header */}
        <header>

          {/* ค้นหา Device จาก Header */}
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

          {/* ปุ่ม Notification และ Avatar */}
          <div className="header-actions">

            <div className="alert-wrap">
              <button
                className="icon-btn"
                onClick={() => setAlertsOpen(!alertsOpen)}
              >
                <Icon name="bell"/>
                <i/>
              </button>

              {/* Notification Popup */}
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
                      <i className="event orange">
                        <Icon name="alarm" size={15}/>
                      </i>

                      <span>
                        <b>{alert}</b>

                        <small>
                          {devices[index]?.name ?? 'System'} · {index * 7 + 2}m ago
                        </small>
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

            {/* Avatar */}
            <div className="avatar">
              {userInitials}
            </div>

          </div>
        </header>

        {/* -------------------------------------------------
           18.3 PAGE CONTENT
           แสดงหน้าตาม page ที่ผู้ใช้เลือก
        ------------------------------------------------- */}

        <div className="content">

          {/* กำลังโหลด Device */}
          {devicesLoading ? (
            <div className="empty-state">
              <b>Loading devices...</b>
            </div>
          ) : deviceError ? (
            /* เกิดข้อผิดพลาดในการโหลด Device */
            <div
              className="empty-state"
              style={{ color: '#dc2626' }}
            >
              <b>Unable to load devices</b>
              <span>{deviceError}</span>
            </div>
          ) : (
            <>

              {/* Dashboard */}
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

              {/* Devices และ Device Detail */}
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

              {/* History และ Alarm */}
              {(page === 'history' || page === 'alarm') && (
                <SimplePage
                  devices={devices}
                  page={page}
                />
              )}

            </>
          )}
        </div>
      </main>

      {/* ===================================================
         19. ADD DEVICE MODAL
         หน้าต่างเพิ่มกล้องใหม่
      =================================================== */}

      {addOpen && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={handleAddDevice}
          >
            <div className="modal-head">
              <div>
                <span className="overline">NEW CAMERA</span>
                <h2>Add device</h2>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setAddOpen(false)}
              >
                <Icon name="close"/>
              </button>
            </div>

            {/* ชื่อ Device */}
            <label>
              Device name

              <input
                name="name"
                required
                placeholder="e.g. CAM-Lobby 01"
              />
            </label>

            {/* ตำแหน่งติดตั้ง */}
            <label>
              Location

              <input
                name="place"
                required
                placeholder="e.g. Main lobby"
              />
            </label>

            {/* ThingsBoard Device ID */}
            <label>
              ThingsBoard device ID

              <input
                name="thingboardId"
                required
                placeholder="Enter ThingsBoard Device UUID"
              />
            </label>

            {/* ปุ่มบันทึก */}
            <div className="modal-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </button>

              <button className="primary-btn compact">
                Add device
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================
         20. EDIT DEVICE MODAL
         หน้าต่างแก้ไขข้อมูลกล้อง
      =================================================== */}

      {editOpen && activeDevice && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={handleEditDevice}
          >
            <div className="modal-head">
              <div>
                <span className="overline">DEVICE SETTINGS</span>
                <h2>Edit device</h2>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditOpen(false)}
              >
                <Icon name="close"/>
              </button>
            </div>

            {/* ชื่อ Device */}
            <label>
              Device name

              <input
                name="name"
                required
                defaultValue={activeDevice.name}
              />
            </label>

            {/* ตำแหน่ง */}
            <label>
              Location

              <input
                name="place"
                required
                defaultValue={activeDevice.place}
              />
            </label>

            {/* ThingsBoard ID */}
            <label>
              ThingsBoard device ID

              <input
                name="thingboardId"
                required
                defaultValue={activeDevice.thingsBoardId}
              />
            </label>

            {/* ปุ่มบันทึก */}
            <div className="modal-actions">
              <button
                type="button"
                className="outline-btn"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>

              <button className="primary-btn compact">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
