'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import posthog from 'posthog-js';
import { fullCourseData } from '@/lib/type';
import { useTimetable } from '@/lib/TimeTableContext';
import { exportToPDF } from '@/lib/exportToPDF';
import Image from 'next/image';
import './saved.css';
import { setPlannerStoredValue } from '@/lib/plannerStorage';
import { getChennaiCourseType, getCourseCredits } from '@/lib/chennaiCatalog';
import LoginModal from '@/components/loginPopup';


/* ── Slot → timetable grid mapping ── */
const THEORY_SLOTS: Record<string, [number, number][]> = {};
const LAB_SLOTS: Record<string, [number, number][]> = {};

const theoryLabels = [
    ['A1', 'F1', 'D1', 'TB1', 'TG1', '', 'A2', 'F2', 'D2', 'TB2', 'TG2', 'S3'],
    ['B1', 'G1', 'E1', 'TC1', 'TAA1', '', 'B2', 'G2', 'E2', 'TC2', 'TAA2', 'S1'],
    ['C1', 'A1', 'F1', 'TD1', 'TBB1', '', 'C2', 'A2', 'F2', 'TD2', 'TBB2', 'S4'],
    ['D1', 'B1', 'G1', 'TE1', 'TCC1', '', 'D2', 'B2', 'G2', 'TE2', 'TCC2', 'S2'],
    ['E1', 'C1', 'TA1', 'TF1', 'TDD1', 'S15', 'E2', 'C2', 'TA2', 'TF2', 'TDD2', ''],
];
const labLabels = [
    ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L31', 'L32', 'L33', 'L34', 'L35', 'L36'],
    ['L7', 'L8', 'L9', 'L10', 'L11', 'L12', 'L37', 'L38', 'L39', 'L40', 'L41', 'L42'],
    ['L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'L43', 'L44', 'L45', 'L46', 'L47', 'L48'],
    ['L19', 'L20', 'L21', 'L22', 'L23', 'L24', 'L49', 'L50', 'L51', 'L52', 'L53', 'L54'],
    ['L25', 'L26', 'L27', 'L28', 'L29', 'L30', 'L55', 'L56', 'L57', 'L58', 'L59', 'L60'],
];

theoryLabels.forEach((row, r) => row.forEach((s, c) => {
    if (!s) return;
    if (!THEORY_SLOTS[s]) THEORY_SLOTS[s] = [];
    THEORY_SLOTS[s].push([r, c]);
}));
labLabels.forEach((row, r) => row.forEach((s, c) => {
    if (!s) return;
    if (!LAB_SLOTS[s]) LAB_SLOTS[s] = [];
    LAB_SLOTS[s].push([r, c]);
}));

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const THEORY_TIMES = [
    '8:00-8:50', '8:55-9:45', '9:50-10:40', '10:45-11:35', '11:40-12:30',
    '12:30-1:20', '2:00-2:50', '2:55-3:45', '3:50-4:40', '4:45-5:35',
    '5:40-6:30', '6:35-7:25', '',
];

const SLOT_COLORS = [
    '#93C5FD', '#86EFAC', '#C4B5FD', '#FDE68A', '#FCA5A5',
    '#7DD3FC', '#6EE7B7', '#FCD34D', '#DDD6FE', '#99F6E4',
];

function getSlotColor(code: string, allCodes: string[]): string {
    const unique = [...new Set(allCodes)];
    const idx = unique.indexOf(code);
    return SLOT_COLORS[idx % SLOT_COLORS.length];
}

/* ── Types ── */
interface TimetableEntry {
    _id: string;
    title: string;
    isPublic: boolean;
    shareId?: string;
    createdAt?: string;
    slots: {
        slot: string;
        courseCode: string;
        courseName: string;
        facultyName: string;
    }[];
}

async function fetchTimetablesByOwner(owner: string) {
    const res = await axios.get(`/api/timetables?owner=${encodeURIComponent(owner)}`);
    return res.data;
}

/* ── Cookie Helpers ── */
const setCookie = (name: string, value: string, days = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
};

/* ── Convert Timetable to Course Preferences ── */
function convertTimetableToCoursePreferences(tt: TimetableEntry): fullCourseData[] {
    // Group slots by courseCode, courseName
    const courseMap = new Map<string, {
        courseCode: string;
        courseName: string;
        slots: Map<string, string[]>;
    }>();

    tt.slots.forEach(entry => {
        const key = `${entry.courseCode}|||${entry.courseName}`;
        if (!courseMap.has(key)) {
            courseMap.set(key, {
                courseCode: entry.courseCode,
                courseName: entry.courseName,
                slots: new Map(),
            });
        }
        const course = courseMap.get(key)!;

        if (!course.slots.has(entry.slot)) {
            course.slots.set(entry.slot, []);
        }
        course.slots.get(entry.slot)!.push(entry.facultyName);
    });

    // Convert to fullCourseData[]
    const result: fullCourseData[] = [];
    courseMap.forEach(course => {
        const courseSlots = Array.from(course.slots.entries()).map(([slotName, faculties]) => ({
            slotName,
            slotFaculties: faculties.map(facultyName => ({ facultyName })),
        }));

        result.push({
            id: `${course.courseCode} - ${course.courseName}_${Array.from(course.slots.keys()).join('_')}`,
            courseType: getChennaiCourseType(course.courseCode),
            courseCode: course.courseCode,
            courseName: course.courseName,
            courseSlots,
        });
    });

    return result;
}

/* ── Main Page ── */
export default function SavedPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const userEmail = session?.user?.email;
    const { setTimetableData } = useTimetable();

    const [timetables, setTimetables] = useState<TimetableEntry[] | null>(null);
    const [selectedTT, setSelectedTT] = useState<TimetableEntry | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'view'>('list');

    /* modal states */
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [shareOpen, setShareOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [toast, setToast] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollTimetables, setCanScrollTimetables] = useState(false);

    /* survey states */
    const [showSurvey, setShowSurvey] = useState(false);
    const [surveyRating, setSurveyRating] = useState(0);
    const [surveyComment, setSurveyComment] = useState('');
    const [surveySubmitting, setSurveySubmitting] = useState(false);

    // Unique value per mount — ensures the fetch effect re-runs every time
    // this component mounts, even if userEmail/status haven't changed
    const [mountId] = useState(() => Date.now());

    // Derived loading: true while session is loading OR while auth is ready but fetch hasn't returned yet
    const loading = status === 'loading' || (status === 'authenticated' && timetables === null);

    function scrollLeft() { scrollRef.current?.scrollBy({ left: -380, behavior: 'smooth' }); }
    function scrollRight() { scrollRef.current?.scrollBy({ left: 380, behavior: 'smooth' }); }



    // Fetch timetables — runs on every mount (mountId is unique per mount)
    // and whenever userEmail or auth status becomes available
    useEffect(() => {
        if (status !== 'authenticated' || !userEmail) return;
        let cancelled = false;
        fetchTimetablesByOwner(userEmail)
            .then(data => { if (!cancelled) setTimetables(data); })
            .catch(() => { if (!cancelled) setTimetables([]); });
        return () => { cancelled = true; };
    }, [userEmail, status, mountId]);

    useEffect(() => {
        let frameId = 0;

        if (viewMode !== 'list') {
            frameId = window.requestAnimationFrame(() => setCanScrollTimetables(false));
            return () => window.cancelAnimationFrame(frameId);
        }

        const container = scrollRef.current;
        if (!container) return;

        const updateScrollState = () => {
            setCanScrollTimetables(container.scrollWidth > container.clientWidth + 1);
        };

        frameId = window.requestAnimationFrame(updateScrollState);

        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
        resizeObserver?.observe(container);

        window.addEventListener('resize', updateScrollState);

        return () => {
            window.cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateScrollState);
        };
    }, [timetables?.length, loading, viewMode]);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    }, []);

    useEffect(() => {
        if (timetables && timetables.length > 0) {
            const hasSeen = localStorage.getItem('ffcs_survey_completed_or_dismissed');
            if (!hasSeen) {
                const timer = setTimeout(() => {
                    setShowSurvey(true);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [timetables]);

    const handleSurveySubmit = async () => {
        if (surveyRating === 0) return;
        setSurveySubmitting(true);
        try {
            const submissionText = `[SURVEY RATING: ${surveyRating}/5] ${surveyComment}`;
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback: submissionText,
                    userName: session?.user?.name,
                    email: session?.user?.email,
                }),
            });

            if (res.ok) {
                posthog.capture('feedback_submitted', {
                    rating: surveyRating,
                    comment: surveyComment,
                    source: 'saved_page_survey',
                    email: session?.user?.email,
                    userName: session?.user?.name,
                });
                localStorage.setItem('ffcs_survey_completed_or_dismissed', 'true');
                setShowSurvey(false);
                showToast('Thank you for your feedback!');
            } else {
                showToast('Failed to submit feedback.');
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            showToast('Error submitting feedback.');
        } finally {
            setSurveySubmitting(false);
        }
    };

    const handleSurveyDismiss = () => {
        localStorage.setItem('ffcs_survey_completed_or_dismissed', 'true');
        setShowSurvey(false);
    };

    const handlePrevious = () => {
        if (viewMode === 'view') {
            setViewMode('list');
            setSelectedTT(null);
            return;
        }
        router.push('/timetable');
    };

    /* ── Handlers ── */
    function handleEdit(tt: TimetableEntry) {
        if (tt._id.startsWith('mock')) return;

        // Clear timetable context for fresh generation
        setTimetableData(null);

        // Convert timetable to course preferences format
        const coursePreferences = convertTimetableToCoursePreferences(tt);

        // Save to cookie
        setPlannerStoredValue('preferenceCourses', JSON.stringify(coursePreferences));

        // Store the timetable ID being edited
        setCookie('editingTimetableId', tt._id);

        // Navigate to courses page
        router.push('/courses');
    }

    async function handleDelete() {
        if (!selectedTT) return;
        if (selectedTT._id.startsWith('mock')) {
            setDeleteOpen(false);
            showToast('Save a real timetable first — these are just preview cards.');
            return;
        }
        try {
            await axios.delete(`/api/timetables/${selectedTT._id}`);
            setTimetables(prev => (prev ?? []).filter(t => t._id !== selectedTT._id));
            setDeleteOpen(false);
            setSelectedTT(null);
            setViewMode('list');
            showToast('Timetable deleted successfully');
        } catch {
            setDeleteOpen(false);
            showToast('Failed to delete timetable. Please try again.');
        }
    }

    async function handleRename() {
        if (!selectedTT || !renameValue.trim()) return;
        try {
            await axios.patch(`/api/timetables/${selectedTT._id}`, { title: renameValue });
            setTimetables(prev =>
                (prev ?? []).map(t => (t._id === selectedTT._id ? { ...t, title: renameValue } : t))
            );
            if (selectedTT) setSelectedTT({ ...selectedTT, title: renameValue });
            setRenameOpen(false);
            showToast('Timetable renamed');
        } catch (error: unknown) {
            const detail = axios.isAxiosError(error)
                ? error.response?.data?.detail || error.response?.data?.error || error.message
                : error instanceof Error
                    ? error.message
                    : 'Unknown error';
            console.error('Rename error:', detail, error);
            showToast(`Failed to rename: ${detail}`);
        }
    }

    async function copyToClipboard(text: string): Promise<boolean> {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // Fall through to fallback
            }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch {
            return false;
        }
    }

    async function handleCopyLink() {
        if (!selectedTT) return;
        try {
            if (!selectedTT.isPublic || !selectedTT.shareId) {
                await axios.patch(`/api/timetables/${selectedTT._id}`, { isPublic: true });
            }
            const { data } = await axios.get(`/api/timetables/${selectedTT._id}`);
            const url = `${window.location.origin}/share/${data.shareId}`;
            const copied = await copyToClipboard(url);
            posthog.capture('timetable_shared', {
                source: 'saved_timetables_page',
                timetable_id: selectedTT._id,
                slots_count: selectedTT.slots.length,
                copied_to_clipboard: copied,
            });
            setShareUrl(url);
            setShareOpen(true);
            if (copied) {
                showToast('Share link copied to clipboard!');
            } else {
                showToast('Share link ready to copy.');
            }
        } catch {
            showToast('Failed to copy share link. Please try again.');
        }
    }

    const displayTimetables = timetables ?? [];
    const sharePrompt = 'Check out my FFCS timetable';
    const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${sharePrompt}: ${shareUrl}`)}`;
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(sharePrompt)}`;

    return (
        <div className="saved-page">

            {viewMode === 'list' ? (
                <>
                    {/* Main content */}
                    <div className="main-content">
                        <h1 data-tour="saved-intro" className="page-title">View Your Saved Timetable</h1>

                        <div data-tour="saved-timetables-list" className="cards-outer">
                            {loading ? (
                                <div className="spinner-center">
                                    <div className="spinner spinner-md" />
                                </div>
                            ) : displayTimetables.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon-container">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                        </svg>
                                    </div>
                                    <h2 className="empty-title">No saved timetables yet</h2>
                                    <p className="empty-desc">Go through the steps to build and save your first timetable.</p>
                                    <button onClick={() => router.push('/preferences')} className="empty-btn">
                                        Create a Timetable
                                    </button>
                                </div>
                            ) : (
                                <div className="cards-scroller-wrapper">
                                    {/* White background wrapping cards + arrows */}
                                    <div className="white-cards-outer relative">
                                        <div ref={scrollRef} className={`white-cards-box ${canScrollTimetables ? '' : 'hide-scrollbar'}`}>
                                            {displayTimetables.map((tt, i) => (
                                                <TimetableCard
                                                    key={tt._id}
                                                    tt={tt}
                                                    index={i}
                                                    allTimetables={displayTimetables}
                                                    onView={() => {
                                                        setSelectedTT(tt);
                                                        setViewMode('view');
                                                    }}
                                                    onEdit={() => handleEdit(tt)}
                                                    onRename={() => {
                                                        setSelectedTT(tt);
                                                        setRenameValue(tt.title);
                                                        setRenameOpen(true);
                                                    }}
                                                    onDelete={() => {
                                                        setSelectedTT(tt);
                                                        setDeleteOpen(true);
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {/* Scroll arrows overlay */}
                                        {canScrollTimetables && (
                                            <>
                                                <button onClick={scrollLeft} className="arrow-btn-absolute absolute-left" aria-label="Scroll left">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E40AF" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                                                </button>
                                                <button onClick={scrollRight} className="arrow-btn-absolute absolute-right" aria-label="Scroll right">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E40AF" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Navigation */}
                    <div
                        className="fixed bottom-0 left-0 right-0 z-40 bg-[#F6F2DD] py-6 px-[clamp(16px,2vw,32px)] w-full flex justify-center"
                        style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
                    >
                        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 w-full">
                            <div className="flex items-center justify-start gap-3 w-full sm:w-auto shrink-0">
                                <button
                                    type="button"
                                    onClick={() => router.push('/')}
                                    aria-label="Go to home page"
                                    title="Home"
                                    className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-center min-w-14.5 min-h-14.5 hover:bg-gray-50 transition-colors shrink-0"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-6 h-6 text-gray-800"
                                        aria-hidden="true"
                                    >
                                        <path d="M3 10.5L12 3l9 7.5" />
                                        <path d="M5 9.5V21h14V9.5" />
                                        <path d="M9 21v-6h6v6" />
                                    </svg>
                                </button>

                                {/* LEFT - USER BOX */}
                                <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                                    {session?.user?.image ? (
                                        <Image src={session.user.image} alt="User avatar" width={36} height={36} className="w-9 h-9 rounded-lg border border-gray-100 shrink-0" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-9 h-9 bg-gray-300 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0">
                                            {session?.user?.name?.[0] || '?'}
                                        </div>
                                    )}
                                    <span className="text-gray-800 text-sm font-bold truncate max-w-50 pr-2">
                                        {session?.user?.name || 'Guest'}
                                    </span>
                                </div>
                            </div>

                            {/* CENTER - STEPS BOX */}
                            <div className="bg-white rounded-xl p-2 shadow-sm flex flex-wrap justify-center items-center gap-2 w-full sm:w-auto order-last md:order-0 mt-2 md:mt-0">
                                {[1, 2, 3, 4].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            if (num === 1) router.push('/preferences');
                                            if (num === 2) router.push('/courses');
                                            if (num === 3) router.push('/timetable');
                                            if (num === 4) router.push('/saved');
                                        }}
                                        className={`h-9.5 flex items-center justify-center rounded-md font-bold text-sm cursor-pointer transition-colors border-none ${
                                            num === 4
                                                ? 'bg-[#A0C4FF] text-black px-4 min-w-9.5'
                                                : 'bg-[#A0C4FF]/40 text-black min-w-9.5'
                                        }`}
                                    >
                                        {num === 4 ? '4. Saved' : num}
                                    </button>
                                ))}
                            </div>

                            {/* RIGHT - ACTION BOX */}
                            <div className="flex gap-3 justify-end shrink-0 ml-auto mr-auto sm:mr-0 mt-2 sm:mt-0">
                                <button
                                    onClick={handlePrevious}
                                    className="px-8 py-3 bg-[#f1eacb] hover:bg-[#E8DDB8] border-2 border-[#A0C4FF] rounded-[10px] font-bold text-sm text-black transition-all duration-200"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled
                                    className="px-10 py-3 bg-[#A0C4FF] rounded-[10px] font-bold text-sm text-black transition-all duration-200 cursor-not-allowed opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : selectedTT ? (
                <TimetableDetailView
                    tt={selectedTT}
                    onBack={() => { setViewMode('list'); setSelectedTT(null); }}
                    onRename={() => { setRenameValue(selectedTT.title); setRenameOpen(true); }}
                    onDelete={() => setDeleteOpen(true)}
                    onCopyLink={handleCopyLink}
                    session={session}
                    router={router}
                    showToast={showToast}
                />
            ) : null}

            {/* Rename Modal */}
            {renameOpen && (
                <div 
                    className="fixed inset-0 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm" 
                    style={{ zIndex: 99999 }}
                    onClick={() => setRenameOpen(false)}
                >
                    <div
                        className="relative w-full max-w-118 animate-[scaleIn_0.2s_ease] overflow-hidden rounded-[30px] border border-[#eadcc5] bg-[#FFF8E7] p-7 shadow-[0_24px_70px_rgba(74,54,30,0.18)] sm:p-8"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4! flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#A0C4FF]/65 text-black shadow-[0_10px_22px_rgba(160,196,255,0.28)]">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-[24px] font-black leading-tight text-black">Rename Timetable</h3>
                                <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#6b6257]">Enter a new name for your timetable.</p>
                            </div>
                        </div>
                        <div className="mb-3! rounded-2xl border border-[#eadcc5] bg-white p-2.5 shadow-[0_8px_24px_rgba(74,54,30,0.05)]">
                            <input
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                className="w-full rounded-xl bg-[#F8E8D2]/45 px-4 py-3.5 text-[16px] font-semibold text-black outline-none transition-all placeholder:font-medium placeholder:text-[#8a8177] focus:ring-2 focus:ring-[#A0C4FF]/45"
                                placeholder="Timetable name"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleRename()}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <button onClick={() => setRenameOpen(false)} className="min-h-13 rounded-2xl bg-white px-6 py-3.5 text-center text-[16px] font-black text-[#6b6257] shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-colors hover:bg-[#f6ead8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/60">Cancel</button>
                            <button onClick={handleRename} className="min-h-13 rounded-2xl bg-[#A0C4FF] px-6 py-3.5 text-center text-[16px] font-black text-black shadow-[0_8px_20px_rgba(160,196,255,0.32)] transition-all hover:bg-[#8eb1ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/70 active:scale-[0.98]">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteOpen && (
                <div 
                    className="fixed inset-0 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm" 
                    style={{ zIndex: 99999 }}
                    onClick={() => setDeleteOpen(false)}
                >
                    <div
                        className="relative w-full max-w-118 animate-[scaleIn_0.2s_ease] overflow-hidden rounded-[30px] border border-[#eadcc5] bg-[#FFF8E7] p-7 shadow-[0_24px_70px_rgba(74,54,30,0.18)] sm:p-8"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4! flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFE4E6] text-[#E11D48] shadow-[0_10px_22px_rgba(225,29,72,0.14)]">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </div>
                            <div>
                                <h3 className="text-[24px] font-black leading-tight text-black">Delete Timetable</h3>
                                <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#6b6257]">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="mb-3! rounded-2xl border border-[#eadcc5] bg-white p-4 text-center shadow-[0_8px_24px_rgba(74,54,30,0.05)]">
                            <p className="text-[14px] font-semibold text-[#6b6257]">Are you sure you want to delete</p>
                            <p className="mt-1 text-[16px] font-black text-black">&quot;{selectedTT?.title}&quot;?</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <button onClick={() => setDeleteOpen(false)} className="min-h-13 rounded-2xl bg-white px-6 py-3.5 text-center text-[16px] font-black text-[#6b6257] shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-colors hover:bg-[#f6ead8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/60">Cancel</button>
                            <button onClick={handleDelete} className="min-h-13 rounded-2xl bg-[#FFE4E6] px-6 py-3.5 text-center text-[16px] font-black text-[#BE123C] shadow-[0_8px_20px_rgba(225,29,72,0.12)] transition-all hover:bg-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDA4AF] active:scale-[0.98]">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {shareOpen && (
                <div 
                    className="fixed inset-0 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm" 
                    style={{ zIndex: 99999 }}
                    onClick={() => setShareOpen(false)}
                >
                    <div
                        className="relative w-full max-w-118 animate-[scaleIn_0.2s_ease] overflow-hidden rounded-[30px] border border-[#eadcc5] bg-[#FFF8E7] p-7 shadow-[0_24px_70px_rgba(74,54,30,0.18)] sm:p-8"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4! flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#A0C4FF]/65 text-black shadow-[0_10px_22px_rgba(160,196,255,0.28)]">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-[24px] font-black leading-tight text-black">Timetable Link</h3>
                                <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[#6b6257]">Copy the public link or share it directly.</p>
                            </div>
                        </div>

                        <div className="mb-1! rounded-2xl border border-[#eadcc5] bg-white p-2.5 shadow-[0_8px_24px_rgba(74,54,30,0.05)]">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="min-w-0 flex-1 rounded-xl bg-[#F8E8D2]/45 px-4 py-3 text-[13px] font-semibold text-[#1f2937] outline-none"
                                    aria-label="Saved timetable share link"
                                />
                                <button
                                    onClick={async () => {
                                        const copied = await copyToClipboard(shareUrl);
                                        if (copied) showToast('Share link copied!');
                                    }}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#A0C4FF] text-black transition-all hover:bg-[#8ab2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/70 active:scale-95"
                                    title="Copy to clipboard"
                                >
                                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="mb-3! grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <a
                                href={whatsappShareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-[#bfead0] bg-[#C8F7DC] px-4 py-3 text-[15px] font-semibold text-black transition-all hover:bg-[#b0eac8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F7DC] active:scale-[0.98]"
                            >
                                WhatsApp
                            </a>
                            <a
                                href={telegramShareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-[#d8e5fb] bg-[#A0C4FF] px-4 py-3 text-[15px] font-semibold text-black transition-all hover:bg-[#8fb6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/70 active:scale-[0.98]"
                            >
                                Telegram
                            </a>
                        </div>

                        <div className="pt-1">
                            <button
                                onClick={() => setShareOpen(false)}
                                className="w-full rounded-2xl bg-white px-6 py-3.5 text-center text-[16px] font-black text-[#6b6257] shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-colors hover:bg-[#f6ead8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/60"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Feedback Survey Modal (Slide-in) */}
            {showSurvey && (
                <div 
                    className="fixed bottom-6 right-6 w-full max-w-sm animate-[scaleIn_0.2s_ease] overflow-hidden rounded-[24px] border border-[#eadcc5] bg-[#FFF8E7]/95 backdrop-blur-md p-6 shadow-[0_24px_60px_rgba(74,54,30,0.2)]"
                    style={{ zIndex: 99999 }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-[20px] font-black text-gray-900 tracking-tight">Quick Feedback</h4>
                            <p className="text-[13px] font-semibold text-[#6b6257] mt-1">How is your experience with FFCS Planner?</p>
                        </div>
                        <button
                            onClick={handleSurveyDismiss}
                            className="text-gray-400 hover:text-gray-900 transition-colors p-1 hover:bg-[#eadcc5]/40 rounded-full border-none bg-transparent cursor-pointer"
                            aria-label="Dismiss feedback survey"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex gap-2 justify-center mb-5">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setSurveyRating(star)}
                                className="transition-all border-none bg-transparent cursor-pointer p-0.5"
                            >
                                <svg 
                                    width="28" 
                                    height="28" 
                                    viewBox="0 0 24 24" 
                                    fill={surveyRating >= star ? "#F59E0B" : "none"} 
                                    stroke={surveyRating >= star ? "#F59E0B" : "#A3A3A3"} 
                                    strokeWidth="2.2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    className={`transition-all duration-150 hover:scale-115 active:scale-95 ${
                                        surveyRating >= star ? 'drop-shadow-[0_2px_8px_rgba(245,158,11,0.25)]' : ''
                                    }`}
                                >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                            </button>
                        ))}
                    </div>

                    <div className="mb-4">
                        <textarea
                            value={surveyComment}
                            onChange={(e) => setSurveyComment(e.target.value)}
                            placeholder="Optional: Tell us what you like or what could be better..."
                            rows={3}
                            className="w-full text-sm rounded-xl border border-[#eadcc5] bg-white/85 px-3.5 py-2.5 text-black outline-none transition-all placeholder:text-[#8a8177] focus:ring-2 focus:ring-[#3B5BDB]/25 focus:border-[#3B5BDB] resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSurveySubmit}
                        disabled={surveyRating === 0 || surveySubmitting}
                        className={`w-full py-3 rounded-xl font-extrabold text-[15px] text-center border-none transition-all cursor-pointer ${
                            surveyRating === 0 || surveySubmitting
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                : 'bg-[#3B5BDB] text-white shadow-lg shadow-[#3B5BDB]/25 hover:bg-[#2B4BCE] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
                        }`}
                    >
                        {surveySubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </div>
            )}
            {/* Toast */}
            {toast && (
                <div className="toast" style={{ zIndex: 100000 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A7F3D0" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                    {toast}
                </div>
            )}
        </div>
    );
}

/* ── Timetable Card Component ── */
function TimetableCard({
    tt,
    index,
    onView,
    onEdit,
    onRename,
    onDelete,
}: {
    tt: TimetableEntry;
    index: number;
    allTimetables: TimetableEntry[];
    onView: () => void;
    onEdit: () => void;
    onRename: () => void;
    onDelete: () => void;
}) {
    const pastelBgs = ['#FFF3C4', '#D9F5E4', '#EBD9FA', '#FFD9E8', '#D9EEF5', '#F5E8D9'];
    const bgColor = pastelBgs[index % pastelBgs.length];

    let dateLabel = '';
    if (tt.createdAt) {
        const d = new Date(tt.createdAt);
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
        const day = d.getDate();
        const month = d.toLocaleString('en-US', { month: 'long' });
        dateLabel = `${time} - ${day} ${month}`;
    }

    const allCodes = tt.slots.map(s => s.courseCode);
    const theoryGrid: (string | null)[][] = Array.from({ length: 5 }, () => Array(12).fill(null));
    const labGrid: (string | null)[][] = Array.from({ length: 5 }, () => Array(12).fill(null));
    tt.slots.forEach(s => {
        s.slot.split('+').forEach(p => {
            const slotCode = p.trim();
            THEORY_SLOTS[slotCode]?.forEach(([r, c]) => {
                theoryGrid[r][c] = s.courseCode;
            });
            LAB_SLOTS[slotCode]?.forEach(([r, c]) => {
                labGrid[r][c] = s.courseCode;
            });
        });
    });
    const gridRows: (string | null)[][] = [];
    for (let d = 0; d < 5; d++) { gridRows.push(theoryGrid[d]); gridRows.push(labGrid[d]); }

    return (
        <div className="tt-card" style={{ backgroundColor: bgColor }}>
            <div className="mini-grid-container">
                {/* Top icons over grid */}
                <div className="card-icons-top">
                    <button onClick={e => { e.stopPropagation(); onRename(); }} className="card-icon-btn" title="Rename">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="12" height="16" rx="2" ry="2"></rect>
                            <path d="M6 15l3-6 3 6"></path>
                            <path d="M7 13h4"></path>
                            <path d="M19 4v16"></path>
                            <path d="M17 4h4"></path>
                            <path d="M17 20h4"></path>
                        </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(); }} className="card-icon-btn card-icon-btn-delete" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                    </button>
                </div>

                {/* Mini grid */}
                <div className="mini-grid">
                    <div className="mini-grid-rows">
                        {gridRows.map((row, rowIdx) => (
                            <div key={rowIdx} className="mini-grid-row">
                                {row.map((cell, colIdx) => (
                                    <div
                                        key={colIdx}
                                        className="mini-grid-cell"
                                        style={{ backgroundColor: cell ? getSlotColor(cell, allCodes) : 'rgba(0,0,0,0.06)' }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Title */}
            <div>
                <h3 className="card-title">{tt.title}</h3>
                <p className="card-subtitle">Generated on</p>
                {dateLabel && <p className="card-date">{dateLabel}</p>}
            </div>

            {/* Buttons */}
            <div className="card-btns">
                <button onClick={e => { e.stopPropagation(); onView(); }} className="card-btn">View</button>
                <button onClick={e => { e.stopPropagation(); onEdit(); }} className="card-btn">Edit</button>
            </div>
        </div>
    );
}

/* ── Detail View Component ── */
function TimetableDetailView({
    tt,
    onBack,
    onDelete,
    onCopyLink,
    onRename,
    session,
    router,
    showToast,
}: {
    tt: TimetableEntry;
    onBack: () => void;
    onRename: () => void;
    onDelete: () => void;
    onCopyLink: () => void;
    session: Session | null;
    router: ReturnType<typeof useRouter>;
    showToast: (msg: string) => void;
}) {
    const [isExporting, setIsExporting] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);

    type CellData = { code: string; courseName: string; facultyName: string; slot: string } | null;
    const theoryGrid: CellData[][] = Array.from({ length: 5 }, () => Array(12).fill(null));
    const labGrid: CellData[][] = Array.from({ length: 5 }, () => Array(12).fill(null));

    tt.slots.forEach(s => {
        s.slot.split('+').forEach(p => {
            const slotCode = p.trim();
            THEORY_SLOTS[slotCode]?.forEach(([r, c]) => {
                theoryGrid[r][c] = { code: s.courseCode, courseName: s.courseName, facultyName: s.facultyName, slot: slotCode };
            });
            LAB_SLOTS[slotCode]?.forEach(([r, c]) => {
                labGrid[r][c] = { code: s.courseCode, courseName: s.courseName, facultyName: s.facultyName, slot: slotCode };
            });
        });
    });

    /* unique courses for Selected Courses table */
    const courseMap = new Map<string, { courseName: string; facultyName: string; slots: string[]; credits: number }>();
    tt.slots.forEach(s => {
        if (!courseMap.has(s.courseCode)) {
            courseMap.set(s.courseCode, { courseName: s.courseName, facultyName: s.facultyName, slots: [], credits: 0 });
        }
        const info = courseMap.get(s.courseCode)!;
        if (!info.slots.includes(s.slot)) {
            info.slots.push(s.slot);
            
            // Calculate credits
            if (s.courseCode.includes('__')) {
                const codes = s.courseCode.split('__');
                const slots = s.slot.split('__');
                info.credits += getCourseCredits(codes[0], slots[0], s.facultyName);
                if (codes[1] && slots[1]) {
                    info.credits += getCourseCredits(codes[1], slots[1], s.facultyName);
                }
            } else {
                info.credits += getCourseCredits(s.courseCode, s.slot, s.facultyName);
            }
        }
    });
    const courses = Array.from(courseMap.entries());
    const totalCredits = courses.reduce((sum, [, info]) => sum + info.credits, 0);
    const exportCreditsLabel = totalCredits.toString();

    const THEORY_TIME_LABELS = [
        '8:00am-\n8:50am', '8:55am-\n9:45am', '9:50am-\n10:40am', '10:45am-\n11:35am',
        '11:40am-\n12:30pm', '12:30pm-\n1:20pm', '2:00pm-\n2:50pm', '2:55pm-\n3:45pm',
        '3:50pm-\n4:40pm', '4:45pm-\n5:35pm', '5:40pm-\n6:30pm', '6:35pm-\n7:25pm',
    ];
    const LAB_TIME_LABELS = [
        '8:00am-\n8:50am', '8:50am-\n9:40am', '9:50am-\n10:40am', '10:40am-\n11:30am',
        '11:40am-\n12:30pm', '12:30pm-\n1:20pm', '2:00pm-\n2:50pm', '2:50pm-\n3:40pm',
        '3:50pm-\n4:40pm', '4:40pm-\n5:30pm', '5:40pm-\n6:30pm', '6:30pm-\n7:20pm',
    ];
    const LUNCH_LETTERS = ['L', 'U', 'N', 'C', 'H'];

    const handleDownload = async (target: 'timetable' | 'slots') => {
        showToast('Preparing PDF...');
        setIsExporting(true);
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            await exportToPDF(target === 'timetable' ? 'saved-timetable-grid' : 'saved-selected-courses-export-sheet', `${tt.title}${target === 'timetable' ? '' : ' - Selected Courses'}.pdf`);
            showToast('PDF downloaded successfully!');
        } catch (error) {
            console.error('PDF error:', error);
            showToast('Failed to generate PDF.');
        } finally {
            setIsExporting(false);
            setShowDownloadModal(false);
        }
    };

    return (
        <div className="dv-page">
            {/* Main scrollable content */}
            <div className="dv-content">
                {/* Title row */}
                <div className="dv-title-row">
                    <button onClick={onBack} className="dv-back-btn">←</button>
                    <h1 className="dv-title">{tt.title}</h1>
                    <div className="dv-title-actions">
                        <button onClick={onRename} className="dv-icon-btn" title="Rename">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button onClick={onDelete} className="dv-icon-btn dv-icon-btn-red" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                        </button>
                    </div>
                </div>

                {/* Timetable grid */}
                <div className="dv-grid-box">
                    <div className="dv-grid-scroll relative" id="saved-timetable-grid">
                        {isExporting && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 opacity-[0.035]">
                                <img src="/mic-logo.png" alt="" className="w-[450px] h-[450px] object-contain select-none" />
                            </div>
                        )}
                        <table className="dv-table">
                            <thead>
                                <tr>
                                    <th className="dv-th-row-label dv-th-label-theory">Theory Hours</th>
                                    {THEORY_TIME_LABELS.slice(0, 6).map((t, i) => (
                                        <th key={`th-${i}`} className="dv-th-time dv-th-time-theory">{t.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}</th>
                                    ))}
                                    <th className="dv-th-lunch" rowSpan={2}></th>
                                    {THEORY_TIME_LABELS.slice(6).map((t, i) => (
                                        <th key={`th-${i + 6}`} className="dv-th-time dv-th-time-theory">{t.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}</th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className="dv-th-row-label dv-th-label-lab">Lab Hours</th>
                                    {LAB_TIME_LABELS.slice(0, 6).map((t, i) => (
                                        <th key={`lh-${i}`} className="dv-th-time dv-th-time-lab">{t.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}</th>
                                    ))}
                                    {/* Lunch th covered by rowSpan above */}
                                    {LAB_TIME_LABELS.slice(6).map((t, i) => (
                                        <th key={`lh-${i + 6}`} className="dv-th-time dv-th-time-lab">{t.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map((day, rowIdx) => (
                                    <React.Fragment key={day}>
                                        {/* Theory row */}
                                        <tr>
                                            <td className="dv-td-day" rowSpan={2}>{day}</td>
                                            {theoryGrid[rowIdx].slice(0, 6).map((cell, colIdx) => (
                                                cell ? (
                                                    <td key={`t-${colIdx}`} className="dv-td dv-td-theory-filled">
                                                        <div className="dv-cell-slot">{theoryLabels[rowIdx]?.[colIdx]}</div>
                                                        <div className="dv-cell-code">{cell.code}</div>
                                                        {isExporting && <div className="dv-cell-course">{cell.courseName}</div>}
                                                    </td>
                                                ) : (
                                                    <td key={`t-${colIdx}`} className="dv-td dv-td-theory-empty">
                                                        <div className="dv-cell-empty">{theoryLabels[rowIdx]?.[colIdx]}</div>
                                                    </td>
                                                )
                                            ))}
                                            {/* Lunch column spans theory + lab rows */}
                                            <td className="dv-td-lunch" rowSpan={2}>
                                                <span className="dv-lunch-label">{LUNCH_LETTERS[rowIdx]}</span>
                                            </td>
                                            {theoryGrid[rowIdx].slice(6).map((cell, colIdx) => (
                                                cell ? (
                                                    <td key={`t-${colIdx + 6}`} className="dv-td dv-td-theory-filled">
                                                        <div className="dv-cell-slot">{theoryLabels[rowIdx]?.[colIdx + 6]}</div>
                                                        <div className="dv-cell-code">{cell.code}</div>
                                                        {isExporting && <div className="dv-cell-course">{cell.courseName}</div>}
                                                    </td>
                                                ) : (
                                                    <td key={`t-${colIdx + 6}`} className="dv-td dv-td-theory-empty">
                                                        <div className="dv-cell-empty">{theoryLabels[rowIdx]?.[colIdx + 6]}</div>
                                                    </td>
                                                )
                                            ))}
                                        </tr>
                                        {/* Lab row — day + lunch covered by rowSpan */}
                                        <tr>
                                            {labGrid[rowIdx].slice(0, 6).map((cell, colIdx) => (
                                                cell ? (
                                                    <td key={`l-${colIdx}`} className="dv-td dv-td-lab-filled">
                                                        <div className="dv-cell-slot">{labLabels[rowIdx]?.[colIdx]}</div>
                                                        <div className="dv-cell-code">{cell.code}</div>
                                                        {isExporting && <div className="dv-cell-course">{cell.courseName}</div>}
                                                    </td>
                                                ) : (
                                                    <td key={`l-${colIdx}`} className="dv-td dv-td-lab-empty">
                                                        <div className="dv-cell-empty">{labLabels[rowIdx]?.[colIdx]}</div>
                                                    </td>
                                                )
                                            ))}
                                            {/* Lunch td covered by rowSpan from theory row */}
                                            {labGrid[rowIdx].slice(6).map((cell, colIdx) => (
                                                cell ? (
                                                    <td key={`l-${colIdx + 6}`} className="dv-td dv-td-lab-filled">
                                                        <div className="dv-cell-slot">{labLabels[rowIdx]?.[colIdx + 6]}</div>
                                                        <div className="dv-cell-code">{cell.code}</div>
                                                        {isExporting && <div className="dv-cell-course">{cell.courseName}</div>}
                                                    </td>
                                                ) : (
                                                    <td key={`l-${colIdx + 6}`} className="dv-td dv-td-lab-empty">
                                                        <div className="dv-cell-empty">{labLabels[rowIdx]?.[colIdx + 6]}</div>
                                                    </td>
                                                )
                                            ))}
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                        {isExporting && (
                            <div className="w-full mt-8 pb-4 text-center text-[15px] text-gray-500/80 font-semibold tracking-wide">
                                Generated via FFCS Planner • Made with ❤️ by Microsoft Innovation Club
                            </div>
                        )}
                    </div>
                    {/* Share / Download buttons */}
                    <div className="dv-grid-actions">
                        <button
                            className="dv-share-btn"
                            onClick={onCopyLink}
                            title="Copy Public Link"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            Share Link
                        </button>
                        <button className="dv-download-btn" onClick={() => setShowDownloadModal(true)} title="Download as PDF">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            Download
                        </button>
                    </div>
                </div>

                {/* Selected Courses */}
                <div className="dv-courses-box">
                    <h2 className="dv-courses-title">Selected Courses</h2>
                    <div className="overflow-x-auto w-full">
                        <table className="dv-courses-table" id="saved-selected-courses-export">
                        <thead>
                            <tr>
                                <th>Slot</th>
                                <th>Course Code</th>
                                <th>Course Name</th>
                                <th>Faculty</th>
                                <th>Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map(([code, info]) => (
                                <tr key={code} className="dv-course-row">
                                    <td style={{ whiteSpace: 'pre-wrap' }}>{info.slots.join('\n')}</td>
                                    <td>{code}</td>
                                    <td>{info.courseName}</td>
                                    <td>{info.facultyName}</td>
                                    <td>{info.credits > 0 ? info.credits : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            <div className="pointer-events-none fixed -left-2500 -top-2500" aria-hidden="true">
                <div id="saved-selected-courses-export-sheet" style={{ width: 1200, background: '#F8E8D2', padding: 48 }}>
                    <div style={{ borderRadius: 36, border: '1px solid #d9d9d9', background: '#fff', paddingLeft: 40, paddingRight: 40, paddingTop: 32, paddingBottom: 40, boxShadow: '0 12px 40px rgba(0,0,0,0.04)' }}>
                        <div style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 24, paddingRight: 24, paddingBottom: 24, marginBottom: 32, borderBottom: '1px solid #ececec' }}>
                            <h2 style={{ margin: 0, textAlign: 'center', fontSize: 34, lineHeight: 1.15, fontWeight: 900, color: '#000' }}>{tt.title}</h2>
                        </div>
                        <div style={{ overflow: 'hidden', borderTop: '1px solid #2c2c2c', borderBottom: '1px solid #2c2c2c', background: '#fff', marginBottom: 32, position: 'relative' }}>
                            {/* Watermark overlay */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10, opacity: 0.035 }}>
                                <img src="/mic-logo.png" alt="" style={{ width: 300, height: 300, objectFit: 'contain', userSelect: 'none' }} />
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', position: 'relative', zIndex: 20 }}>
                                <thead style={{ background: '#D9EBE5' }}>
                                    <tr>
                                        <th style={{ width: '15%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Slot</th>
                                        <th style={{ width: '18%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Course Code</th>
                                        <th style={{ width: '32%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Course Title</th>
                                        <th style={{ width: '18%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Faculty</th>
                                        <th style={{ width: '9%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Venue</th>
                                        <th style={{ width: '8%', padding: '16px 20px', fontSize: 17, fontWeight: 900 }}>Credits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {courses.map(([code, info]) => (
                                        <tr key={code} style={{ borderTop: '1px solid #2c2c2c' }}>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{info.slots.join('\n')}</td>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500 }}>{code}</td>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500 }}>{info.courseName}</td>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500 }}>{info.facultyName}</td>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500 }}>TBD</td>
                                            <td style={{ padding: '16px 20px', fontSize: 16, fontWeight: 500 }}>{info.credits}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderTop: '1px solid #2c2c2c', background: '#E7E7E7' }}>
                                        <td colSpan={6} style={{ padding: '16px 20px', textAlign: 'center', fontSize: 18, fontWeight: 900 }}>
                                            Total Credits: {exportCreditsLabel}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 15, color: '#6b7280', fontWeight: 600, letterSpacing: '0.025em', marginTop: 32, paddingBottom: 16 }}>
                            Generated via FFCS Planner • Made with ❤️ by Microsoft Innovation Club
                        </div>
                    </div>
                </div>
            </div>

                        {showDownloadModal && (
                <div 
                    className="fixed inset-0 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm" 
                    style={{ zIndex: 99999 }}
                    onClick={() => !isExporting && setShowDownloadModal(false)}
                >
                    <div
                        className="relative w-full max-w-118 animate-[scaleIn_0.2s_ease] overflow-hidden rounded-[30px] border border-[#eadcc5] bg-[#FFF8E7] p-7 shadow-[0_24px_70px_rgba(74,54,30,0.18)] sm:p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isExporting ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#3B5BDB]/20 border-t-[#3B5BDB] shadow-md"></div>
                                <h3 className="mt-6 text-[20px] font-black text-black">Generating PDF...</h3>
                                <p className="mt-2 text-center text-[14px] font-medium leading-relaxed text-[#6b6257]">Please wait, we are assembling your schedule.</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4! flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C8F7DC]/80 text-black shadow-[0_10px_22px_rgba(200,247,220,0.3)]">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <path d="M7 10l5 5 5-5" />
                                            <path d="M12 15V3" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-[24px] font-black leading-tight text-black">Download PDF</h2>
                                        <p className="mt-1 text-[14px] font-medium leading-relaxed text-[#6b6257]">Choose the timetable view or selected courses list.</p>
                                    </div>
                                </div>

                                <div className="mb-4! flex flex-col gap-2 sm:grid-cols-2">
                                    <button
                                        onClick={() => handleDownload('timetable')}
                                        className="flex min-h-16 items-center justify-center gap-1 rounded-xl border border-[#bfead0] bg-[#C8F7DC] px-5 py-4 text-[16px] font-semibold text-black shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-all hover:bg-[#b0eac8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F7DC] active:scale-[0.98]"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <rect x="3" y="4" width="18" height="16" rx="2" />
                                            <path d="M7 8h10" />
                                            <path d="M7 12h10" />
                                            <path d="M7 16h6" />
                                        </svg>
                                        Timetable
                                    </button>
                                    <button
                                        onClick={() => handleDownload('slots')}
                                        className="flex min-h-16 items-center justify-center gap-3 rounded-xl border border-[#d8e5fb] bg-[#A0C4FF] px-5 py-4 text-[16px] font-semibold text-black shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-all hover:bg-[#8fb6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/70 active:scale-[0.98]"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M8 6h13" />
                                            <path d="M8 12h13" />
                                            <path d="M8 18h13" />
                                            <path d="M3 6h.01" />
                                            <path d="M3 12h.01" />
                                            <path d="M3 18h.01" />
                                        </svg>
                                        Selected Courses
                                    </button>
                                </div>
                                <div className="pt-1">
                                    <button
                                        onClick={() => setShowDownloadModal(false)}
                                        className="w-full rounded-2xl bg-white px-6 py-3.5 text-center text-[16px] font-black text-[#6b6257] shadow-[0_8px_20px_rgba(74,54,30,0.05)] transition-colors hover:bg-[#f6ead8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0C4FF]/60"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom nav — same as list view */}
            <div className="bottom-nav">
                <div className="bottom-nav-box user-section">
                    <div className="avatar">
                        {session?.user?.image
                            ? <Image src={session.user.image} alt="avatar" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} referrerPolicy="no-referrer" />
                            : (session?.user?.name?.[0] || '?')}
                    </div>
                    <span className="user-name">{session?.user?.name || 'Guest'}</span>
                </div>
                <div className="bottom-nav-box step-pills-container">
                    <div className="step-pills">
                        {[1, 2, 3, 4].map(n => (
                            <button
                                key={n}
                                onClick={() => {
                                    if (n === 1) router.push('/preferences');
                                    if (n === 2) router.push('/courses');
                                    if (n === 3) router.push('/timetable');
                                    if (n === 4) router.push('/saved');
                                }}
                                className={n === 4 ? 'step-pill-saved' : 'step-pill'}
                            >
                                {n === 4 ? '4. Saved' : n}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="nav-btns">
                    <button onClick={onBack} className="btn-prev">Previous</button>
                    <button disabled className="btn-next">Next</button>
                </div>
            </div>

            {status === 'unauthenticated' && (
                <LoginModal
                    onClose={() => {
                        router.push('/');
                    }}
                    callbackUrl={typeof window !== 'undefined' ? window.location.href : '/saved'}
                />
            )}
        </div>
    );
}
