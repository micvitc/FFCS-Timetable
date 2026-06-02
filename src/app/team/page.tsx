"use client";
import React, { useState } from "react";
import Image from "next/image";
import LoginModal from "../../components/loginPopup"
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { clearPlannerClientCache } from "@/lib/clientCache";
import { parseName } from "@/lib/utils";

type FloatingTile = {
  id: number;
  letter: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAngle: number;
  angle: number;
  rotAmplitude: number;
  rotSpeed: number;
  rotPhase: number;
  depth: number;
  depthPhase: number;
  wobblePhase: number;
  vibrationPhase: number;
  jitterX: number;
  jitterY: number;
};

const FLOATING_TILE_SIZE = 44;

const FLOATING_TILE_LAYOUT = [
  { letter: "G", color: "#d1fae5", xPct: 0.48, yPct: 0.1, angle: 18, vx: -0.26, vy: 0.18 },
  { letter: "B", color: "#bfdbfe", xPct: 0.68, yPct: 0.26, angle: -34, vx: -0.2, vy: 0.2 },
  { letter: "E", color: "#a7f3d0", xPct: 0.84, yPct: 0.1, angle: -30, vx: -0.16, vy: 0.26 },
  { letter: "C", color: "#f3e8ff", xPct: 0.1, yPct: 0.44, angle: -22, vx: 0.24, vy: -0.12 },
  { letter: "D", color: "#fef3c7", xPct: 0.34, yPct: 0.58, angle: -8, vx: 0.16, vy: -0.2 },
  { letter: "F", color: "#e9d5ff", xPct: 0.62, yPct: 0.66, angle: 34, vx: 0.22, vy: -0.16 },
  { letter: "A", color: "#fef08a", xPct: 0.84, yPct: 0.62, angle: -8, vx: -0.2, vy: -0.24 }
];

export default function TeamPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [floatingTiles, setFloatingTiles] = useState<FloatingTile[]>([]);
  const floatingContainerRef = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const handleLogout = React.useCallback(() => {
    clearPlannerClientCache({ includeEditingState: true });
    signOut({ callbackUrl: "/" });
  }, []);

  // Inactivity Logout Logic (e.g., 30 minutes of inactivity)
  React.useEffect(() => {
    if (!session) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, 30 * 60 * 1000); // 30 minutes
    };

    // Track user activity
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer(); // Initialize timer

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [session, handleLogout]);

  React.useEffect(() => {
    const container = floatingContainerRef.current;
    if (!container) return;

    const makeInitialTiles = (width: number, height: number): FloatingTile[] => {
      const maxX = Math.max(0, width - FLOATING_TILE_SIZE);
      const maxY = Math.max(0, height - FLOATING_TILE_SIZE);
      return FLOATING_TILE_LAYOUT.map((seed, idx) => ({
        id: idx,
        letter: seed.letter,
        color: seed.color,
        x: seed.xPct * maxX,
        y: seed.yPct * maxY,
        vx: seed.vx * 0.82,
        vy: seed.vy * 0.82,
        baseAngle: seed.angle,
        angle: seed.angle,
        rotAmplitude: 15 + ((idx * 2) % 11),
        rotSpeed: (idx % 2 === 0 ? 1 : -1) * (0.00044 + idx * 0.00003),
        rotPhase: idx * 0.7,
        depth: 0,
        depthPhase: idx * 0.8,
        wobblePhase: idx * 1.2,
        vibrationPhase: idx * 1.7,
        jitterX: 0,
        jitterY: 0
      }));
    };

    const initializeTiles = () => {
      const bounds = container.getBoundingClientRect();
      setFloatingTiles(makeInitialTiles(bounds.width, bounds.height));
    };

    initializeTiles();

    let rafId = 0;
    let lastTime = performance.now();

    const stepAnimation = (now: number) => {
      const elapsed = Math.min(36, now - lastTime);
      const dt = elapsed / 16.666;
      lastTime = now;

      const bounds = container.getBoundingClientRect();
      const maxX = Math.max(0, bounds.width - FLOATING_TILE_SIZE);
      const maxY = Math.max(0, bounds.height - FLOATING_TILE_SIZE);

      setFloatingTiles((prev) => {
        if (prev.length === 0) return prev;

        const next = prev.map((tile) => {
          const driftX = Math.sin(now * 0.00045 + tile.wobblePhase) * 0.016;
          const driftY = Math.cos(now * 0.00037 + tile.wobblePhase * 1.25) * 0.016;
          let vx = (tile.vx + driftX * dt) * 0.996;
          let vy = (tile.vy + driftY * dt) * 0.996;

          const maxSpeed = 0.44;
          const speed = Math.hypot(vx, vy);
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            vx *= scale;
            vy *= scale;
          }

          let x = tile.x + vx * dt;
          let y = tile.y + vy * dt;

          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx) * 0.94;
          } else if (x >= maxX) {
            x = maxX;
            vx = -Math.abs(vx) * 0.94;
          }

          if (y <= 0) {
            y = 0;
            vy = Math.abs(vy) * 0.94;
          } else if (y >= maxY) {
            y = maxY;
            vy = -Math.abs(vy) * 0.94;
          }

          const angleSwing = Math.sin(now * tile.rotSpeed + tile.rotPhase) * tile.rotAmplitude;
          const buzzRotate = Math.sin(now * 0.032 + tile.vibrationPhase * 1.7) * 1.6;
          const angle = tile.baseAngle + angleSwing + buzzRotate;
          const depth = Math.sin(now * 0.0005 + tile.depthPhase);
          const jitterX =
            Math.sin(now * 0.022 + tile.vibrationPhase) * 0.7 +
            Math.sin(now * 0.049 + tile.vibrationPhase * 1.9) * 0.42;
          const jitterY =
            Math.cos(now * 0.02 + tile.vibrationPhase * 1.2) * 0.56 +
            Math.cos(now * 0.053 + tile.vibrationPhase * 2.1) * 0.35;

          return {
            ...tile,
            x,
            y,
            vx,
            vy,
            angle,
            depth,
            jitterX,
            jitterY
          };
        });

        const minDist = FLOATING_TILE_SIZE * 0.82;
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 0 || distance >= minDist) continue;

            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDist - distance;

            next[i].x -= nx * overlap * 0.52;
            next[i].y -= ny * overlap * 0.52;
            next[j].x += nx * overlap * 0.52;
            next[j].y += ny * overlap * 0.52;

            const relVx = next[j].vx - next[i].vx;
            const relVy = next[j].vy - next[i].vy;
            const alongNormal = relVx * nx + relVy * ny;

            if (alongNormal < 0) {
              const impulse = -alongNormal * 0.28;
              next[i].vx -= impulse * nx;
              next[i].vy -= impulse * ny;
              next[j].vx += impulse * nx;
              next[j].vy += impulse * ny;
            }

            next[i].x = Math.max(0, Math.min(maxX, next[i].x));
            next[i].y = Math.max(0, Math.min(maxY, next[i].y));
            next[j].x = Math.max(0, Math.min(maxX, next[j].x));
            next[j].y = Math.max(0, Math.min(maxY, next[j].y));
          }
        }

        return next;
      });

      rafId = window.requestAnimationFrame(stepAnimation);
    };

    rafId = window.requestAnimationFrame(stepAnimation);

    const resizeObserver = new ResizeObserver(() => {
      const bounds = container.getBoundingClientRect();
      const maxX = Math.max(0, bounds.width - FLOATING_TILE_SIZE);
      const maxY = Math.max(0, bounds.height - FLOATING_TILE_SIZE);
      setFloatingTiles((prev) => {
        if (prev.length === 0) {
          return makeInitialTiles(bounds.width, bounds.height);
        }
        return prev.map((tile) => ({
          ...tile,
          x: Math.max(0, Math.min(maxX, tile.x)),
          y: Math.max(0, Math.min(maxY, tile.y))
        }));
      });
    });

    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="landing-page">
      {/* Top Banner and Hero */}
      <div className="white-container">
        <nav className="navbar">
          <div className="logo cursor-pointer" style={{ display: 'flex', alignItems: 'center' }} onClick={() => router.push('/')}>
            <Image src="/mic-logo.png" alt="MIC Logo" width={80} height={40} className="object-contain" priority />
          </div>
          {session ? (
            <div className="relative">
              <div
                className="flex items-center gap-1.5 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {session.user?.image && (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="profile-avatar w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                )}
                <div className="profile-info-container">
                  <span className="profile-name-text font-semibold text-black">
                    {parseName(session.user?.name).name}
                  </span>
                  {parseName(session.user?.name).regNo && (
                    <span className="profile-reg-text">
                      {parseName(session.user?.name).regNo}
                    </span>
                  )}
                </div>
                <svg
                  className={`profile-chevron w-4 h-4 text-black transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-2 animate-lucid-fade-up">
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
                      onClick={handleLogout}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="login-btn" onClick={() => setShowLogin(true)}>Login with Google</button>
          )}
        </nav>
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} />
        )}

        <section className="hero-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="hero-text" style={{ textAlign: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '40px', color: '#111827' }}>Meet Our Team</h1>

            <div className="team-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
              padding: '0 20px'
            }}>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-green-600 text-2xl font-bold">
                  G
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Gowreesh V T</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center text-blue-600 text-2xl font-bold">
                  G
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Gouse Moideen</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center text-purple-600 text-2xl font-bold">
                  S
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Sri Saidhakshini V</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center text-purple-600 text-2xl font-bold">
                  R
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Rahul</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center text-purple-600 text-2xl font-bold">
                  S
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Subhayan Niyogi</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center text-purple-600 text-2xl font-bold">
                  V
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Vishu Jain</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-green-600 text-2xl font-bold">
                  S
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Surya R</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-green-600 text-2xl font-bold">
                  S
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Souptik Dam</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
              <div className="team-card bg-[#FAFAFA] rounded-2xl p-8 shadow-[4px_4px_10px_rgba(0,0,0,0.05)] border border-gray-100 transition-transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-green-600 text-2xl font-bold">
                  A
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Akash Vishnu P</h3>
                <p className="text-gray-500 font-medium">Developer</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="footer-container">
        <div className="footer-top">
          <div className="binding-rings">
            <div className="ring" style={{ background: '#fbcfe8' }}></div>
            <div className="ring" style={{ background: '#bfdbfe' }}></div>
            <div className="ring" style={{ background: '#a7f3d0' }}></div>
            <div className="ring" style={{ background: '#fde047' }}></div>
            <div className="ring" style={{ background: '#c4b5fd' }}></div>
            <div className="ring" style={{ background: '#bbf7d0' }}></div>
            <div className="ring" style={{ background: '#fbcfe8' }}></div>
          </div>
        </div>

        <div className="footer-main">
          <div className="footer-grid">
            <div className="f-block f-about">
              <h3>FFCS</h3>
              <p>
                The Fully Flexible Credit System (FFCS) planning tool helps VIT Chennai students organize their course selections before registration. Create multiple timetables, compare schedules, and prepare for seamless FFCS registration with our intelligent course and slot management system.
              </p>
            </div>

            <div className="f-block f-buttons">
              <button className="f-btn f-btn-gen" onClick={() => router.push('/preferences')}>
                <Image src="/calendar_icon2.png" alt="calendar" width={32} height={32} />
                <span>Generate<br />timetable</span>
              </button>
              <button
                className="f-btn f-btn-saved"
                onClick={() => {
                  if (!session) {
                    setShowLogin(true);
                  } else {
                    router.push('/saved');
                  }
                }}
              >
                <Image src="/Clock.png" alt="clock" width={32} height={32} />
                <span>View saved<br />timetables</span>
              </button>
              <button className="f-btn f-btn-slots" onClick={() => router.push('/slots')}>
                <Image src="/slot_icon.png" alt="slot" width={32} height={32} />
                <span>View slots</span>
              </button>
              <button className="f-btn f-btn-team" onClick={() => router.push('/')}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="32"
                  height="32"
                  aria-hidden="true"
                >
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                  <path d="M9 21v-6h6v6" />
                </svg>
                <span>Go home</span>
              </button>
            </div>

            <div className="f-block f-graphics" ref={floatingContainerRef}>
              {floatingTiles.map((tile) => {
                const scale = 0.96 + (tile.depth + 1) * 0.05;
                const zDepth = Math.round(tile.depth * 10);
                return (
                  <div
                    key={tile.id}
                    className="floating-tile"
                    style={{
                      background: tile.color,
                      transform: `translate3d(${tile.x}px, ${tile.y}px, ${zDepth}px) rotate(${tile.angle}deg) scale(${scale})`,
                      zIndex: Math.round((tile.depth + 1) * 10)
                    }}
                  >
                    {tile.letter}
                  </div>
                );
              })}
            </div>

            <div className="f-block f-credits">
              Built with ❤️ by Microsoft Innovations Club
            </div>

            <div className="f-block f-updates" style={{ padding: '8px' }}>
              <button
                onClick={() => router.push('/feedback')}
                className="w-full flex items-center justify-center gap-2 bg-[#BFDBFE] hover:bg-[#93C5FD] transition-colors rounded-lg cursor-pointer"
                style={{ height: '40px', width: '100%', border: 'none', fontWeight: 700, fontSize: '15px', color: '#000' }}
              >
                Give feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
