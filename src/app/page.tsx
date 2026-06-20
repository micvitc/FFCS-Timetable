"use client";
import React, { useState } from "react";
import Image from "next/image";
import LoginModal from "@/components/loginPopup"
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

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const [animatingTiles, setAnimatingTiles] = useState<Record<number, boolean>>({});
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [floatingTiles, setFloatingTiles] = useState<FloatingTile[]>([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);


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

  const handleTileClick = (index: number) => {
    setAnimatingTiles((prev) => ({ ...prev, [index]: true }));
    setTimeout(() => {
      setAnimatingTiles((prev) => ({ ...prev, [index]: false }));
    }, 1000);
  };

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
        wobblePhase: idx * 1.2
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
          const angle = tile.baseAngle + angleSwing;
          const depth = Math.sin(now * 0.0005 + tile.depthPhase);

          return {
            ...tile,
            x,
            y,
            vx,
            vy,
            angle,
            depth
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
          <div className="logo">FFCS</div>
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

        <section className="hero-section">
          <div className="hero-text">
            <h1>Build Your Timetable</h1>
            <p>
              Plan your perfect timetable with our intuitive<br />
              course selection and slot management tools
            </p>
            <div className="hero-buttons">
              <button className="btn-primary" onClick={() => setOpen(true)}>Get Started</button>
              {open && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
                  <div className="flex items-center justify-center w-full max-w-4xl bg-[#FFFCEE] rounded-[20px] shadow-xl p-6 mx-4 relative">
                    <div className="relative bg-[#FAFAFA] w-full flex flex-col items-center rounded-[20px] p-8 shadow-[4px_4px_4px_rgba(191,191,191,0.25)]">
                      <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black text-[28px] z-10">✕</button>
                      <h2 className="text-[clamp(22px,3vw,32px)] font-semibold text-center mb-2 mt-2">
                        Welcome {session?.user?.name ? `back, ${session.user.name}` : "to FFCS"}!
                      </h2>
                      <div className="w-full max-w-175 h-px bg-gray-300 mb-4"></div>
                      <p className="text-center text-[clamp(16px,2vw,20px)] mb-8">Choose what you&apos;d like to do next</p>
                      <div className="flex flex-wrap gap-8 justify-center mb-4">
                        <button className="flex flex-col items-center justify-center bg-[#E9F3E8] border-[5px] border-[#D4F4E6] rounded-2xl p-6 w-72 max-w-full h-52 shadow hover:bg-green-200 transition text-black" onClick={() => { setOpen(false); router.push('/preferences'); }}>
                          <Image src="/create_new.png" alt="create" width={167} height={101} />
                          <p className="font-medium text-center">Create a new one</p>
                        </button>
                        <button
                          className="flex flex-col items-center justify-center bg-[#E9D5FF] border-[#F2D8FE] border-[5px] rounded-2xl p-6 w-72 max-w-full h-52 shadow hover:bg-purple-300 transition text-black"
                          onClick={() => {
                            if (!session) {
                              setOpen(false);
                              setShowLogin(true);
                            } else {
                              setOpen(false);
                              router.push("/saved");
                            }
                          }}
                        >
                          <Image src="/savedTimetable.png" alt="saved" width={167} height={101} unoptimized />
                          <p className="mt-4 font-medium text-center">
                            {session ? "View saved timetables" : "Log in to view saved timetables"}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <button className="btn-secondary" onClick={() => router.push('/slots')}>Slot View</button>
            </div>
          </div>
          <div className="hero-graphic">
            {/* Calendar pure CSS drawing */}
            <div className="calendar-graphic">
              <div className="cal-top">
                <div className="cal-tab" style={{ background: '#fbcfe8' }}></div>
                <div className="cal-tab" style={{ background: '#bfdbfe' }}></div>
                <div className="cal-tab" style={{ background: '#a7f3d0' }}></div>
                <div className="cal-tab" style={{ background: '#fde047' }}></div>
                <div className="cal-tab" style={{ background: '#c4b5fd' }}></div>
                <div className="cal-tab" style={{ background: '#bbf7d0' }}></div>
                <div className="cal-tab" style={{ background: '#fbcfe8' }}></div>
              </div>
              <div className="cal-grid">
                {[
                  '#93c5fd', '#fde047', '#bbf7d0', '#f3e8ff', '#fde047', '#fbcfe8',
                  '#93c5fd', '#bbf7d0', '#fde047', '#bbf7d0', '#c4b5fd', '#fde047',
                  '#93c5fd', '#bbf7d0', '#fde047', '#bbf7d0', '#c4b5fd', '#93c5fd',
                  '#d8b4e2', '#fde047', '#bbf7d0', '#c4b5fd', '#bbf7d0', '#fde047'
                ].map((color, idx) => (
                  <div
                    key={idx}
                    className={`cal-box ${animatingTiles[idx] ? 'animating' : ''}`}
                    style={{ background: color }}
                    onClick={() => handleTileClick(idx)}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Middle Sections */}
      <div className="middle-section">
        {/* How It Works */}
        <div className="how-it-works-card">
          <h2>How This Site Works?</h2>

          <div className="video-box" style={{ position: 'relative' }}>
            <>
              {/* Option A: Uploadthing Video Player (Active) */}
              <video
                ref={videoRef}
                src="https://h8z6stjynz.ufs.sh/f/nEev6VX4XfKE5CB0pMEvK0cVWaoY4UbStprle19NBx8f3nZT"
                poster="/section1-preview.png"
                controls
                playsInline
                preload="metadata"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                className="w-full h-full object-cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {!isVideoPlaying && (
                <div className="play-icon-overlay" onClick={() => videoRef.current?.play()}>
                  <div className="play-icon-btn"></div>
                </div>
              )}

              {/* Option B: YouTube Player (Commented out - uncomment to swap. If using YouTube, comment out Option A and the overlay above)
              <iframe
                src="https://www.youtube-nocookie.com/embed/lv7asnSPVBw?autoplay=1&rel=0&modestbranding=1"
                title="How FFCS Timetable Works"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              */}
            </>
          </div>

          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <p className="step-text">
                Select your courses and preferences. Choose from available courses based on your specialization and academic requirements.
              </p>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <p className="step-text">
                View available time slots for each course and build your timetable without conflicts. Our tool helps you avoid scheduling overlaps.
              </p>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <p className="step-text">
                Save your timetable and share it with classmates. Export your final schedule for reference during FFCS registration.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-card">
          <h2>Frequently asked questions:</h2>
          <div className="faq-list">
            {[
              {
                q: "Why use this site?",
                a: "Our FFCS planner helps you make informed decisions before registering for courses. Plan ahead, avoid schedule conflicts, and save time during the actual FFCS registration process. It's designed specifically for VIT's course system."
              },
              {
                q: "Will it help me with my\nFFCS?",
                a: "Yes, it helps you organize and plan your timetable seamlessly before the actual FFCS process begins."
              },
              {
                q: "Do I need to be a VIT student to use\nthis site?",
                a: "This tool is specifically designed for the FFCS system at VIT Chennai. However, anyone can try it out!"
              },
              {
                q: "Can I change my timetable\nafter saving?",
                a: "Yes, you can edit your saved timetables anytime. Make adjustments to your course selections and slot preferences before the FFCS registration deadline."
              }
            ].map((faq, index) => (
              (() => {
                const isOpen = activeFaq === index;
                return (
              <div
                key={index}
                className="faq-item"
                style={isOpen ? { background: 'transparent', transition: 'background 0.25s ease' } : { cursor: 'pointer', transition: 'background 0.25s ease' }}
              >
                <div className="faq-question" onClick={() => setActiveFaq(isOpen ? null : index)}>
                  <span>{faq.q.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i === 0 && faq.q.includes('\n') ? <br /> : null}</React.Fragment>)}</span>
                  <span className="faq-icon" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>⌄</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    opacity: isOpen ? 1 : 0,
                    transition: 'grid-template-rows 0.35s ease, opacity 0.2s ease',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div className="faq-answer">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
                );
              })()
            ))}
          </div>
        </div>
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
                <Image src="/calendar_icon2.png" alt="calendar" width={34} height={34} />
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
                <Image src="/Clock.png" alt="clock" width={34} height={34} />
                <span>View saved<br />timetables</span>
              </button>
              <button className="f-btn f-btn-slots" onClick={() => router.push('/slots')}>
                <Image src="/slot_icon.png" alt="slot" width={34} height={34} />
                <span>View slots</span>
              </button>
              <button className="f-btn f-btn-team" onClick={() => router.push('/team')}>
                <Image src="/team_icon.png" alt="team" width={34} height={34} />
                <span>View team</span>
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
