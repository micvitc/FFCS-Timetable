'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';
import { useFeatureFlagEnabled } from '@posthog/react';

import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useTimetable } from '@/lib/TimeTableContext';
import { usePreferences } from '@/lib/PreferencesContext';
import ModeHelpDialog from '@/components/ModeHelpDialog';
import { getPlannerStoredValue, setPlannerStoredValue } from '@/lib/plannerStorage';
import { generateTT } from '@/lib/utils';
import { getSlotViewPayload } from '@/lib/slot-view';
import { clashMap, findMatchingLabSlot } from '@/lib/slots';
import { isTheoryType, isLabType } from '@/lib/chennaiCatalog';
import chennaiCourses from '@/data/all_data_chennai';
import { fullCourseData, timetableDisplayData } from '@/lib/type';

// Types
type FacultyEntry = {
    uid: string;
    no: number;
    courseCode: string;
    courseName: string;
    slot: string;
    facultyName: string;
};

type CourseOption = {
    id: string; // e.g. "CODE_FACULTY_THEORYSLOT_LABSLOT"
    courseCode: string;
    courseName: string;
    facultyName: string;
    theorySlot?: string;
    labSlot?: string;
    credits: number;
    type: 'th' | 'lab' | 'both';
};

const THEORY_FILLED_COLOR = '#BFF0C8';
const THEORY_EMPTY_COLOR = '#E1F9E9';
const LAB_FILLED_COLOR = '#FFE78A';
const LAB_EMPTY_COLOR = '#FFF2BF';

const ALL_SUBJECTS_MODE_HELP = [
    {
        title: 'All Subjects Mode - ON',
        description: 'Generated timetables strictly include all of the selected subjects.',
    },
    {
        title: 'All Subjects Mode - OFF',
        description: 'You can toggle off checkboxes for specific subjects to quickly preview how your timetable looks without them, instead of deleting them entirely.',
    },
];

// Check if two slots clash
const doSlotsClash = (slot1: string, slot2: string): boolean => {
    const slots1 = slot1.split('+').map(s => s.trim());
    const slots2 = slot2.split('+').map(s => s.trim());

    for (const s1 of slots1) {
        for (const s2 of slots2) {
            if (s1 === s2) return true;
            if (clashMap[s1]?.includes(s2)) return true;
            if (clashMap[s2]?.includes(s1)) return true;
        }
    }
    return false;
};

// Help helper
const isLabSlotName = (slot: string): boolean => slot.trim().toUpperCase().startsWith('L');

// Mapper: selected CourseOptions to FacultyEntry[]
const optionsToFacultyEntries = (selectedOptions: CourseOption[]): FacultyEntry[] => {
    const entries: FacultyEntry[] = [];
    selectedOptions.forEach((opt) => {
        if (opt.theorySlot) {
            entries.push({
                uid: `${opt.id}_theory`,
                no: entries.length + 1,
                courseCode: opt.courseCode,
                courseName: opt.courseName,
                slot: opt.theorySlot,
                facultyName: opt.facultyName
            });
        }
        if (opt.labSlot) {
            entries.push({
                uid: `${opt.id}_lab`,
                no: entries.length + 1,
                courseCode: opt.courseCode,
                courseName: opt.courseName,
                slot: opt.labSlot,
                facultyName: opt.facultyName
            });
        }
    });
    return entries;
};

// Mapper: FacultyEntry[] to fullCourseData[]
const buildPreferenceCoursesFromRows = (rows: FacultyEntry[]): fullCourseData[] => {
    const coursesMap = new Map<string, {
        courseCode: string;
        courseName: string;
        facultySlots: Map<string, { theorySlots: string[]; labSlots: string[] }>;
    }>();

    rows.forEach(row => {
        if (!coursesMap.has(row.courseCode)) {
            coursesMap.set(row.courseCode, {
                courseCode: row.courseCode,
                courseName: row.courseName,
                facultySlots: new Map(),
            });
        }

        const courseGroup = coursesMap.get(row.courseCode)!;

        if (!courseGroup.facultySlots.has(row.facultyName)) {
            courseGroup.facultySlots.set(row.facultyName, { theorySlots: [], labSlots: [] });
        }

        const fs = courseGroup.facultySlots.get(row.facultyName)!;
        if (isLabSlotName(row.slot)) {
            if (!fs.labSlots.includes(row.slot)) fs.labSlots.push(row.slot);
        } else {
            if (!fs.theorySlots.includes(row.slot)) fs.theorySlots.push(row.slot);
        }
    });

    const result: fullCourseData[] = [];

    coursesMap.forEach((course) => {
        let hasTheory = false;
        let hasLab = false;
        course.facultySlots.forEach(({ theorySlots, labSlots }) => {
            if (theorySlots.length > 0) hasTheory = true;
            if (labSlots.length > 0) hasLab = true;
        });

        let courseType: 'th' | 'lab' | 'both';
        if (hasTheory && hasLab) courseType = 'both';
        else if (hasLab) courseType = 'lab';
        else courseType = 'th';

        if (courseType === 'both') {
            const theorySlotMap = new Map<string, { facultyName: string; facultyLabSlot?: string }[]>();

            course.facultySlots.forEach(({ theorySlots, labSlots }, facultyName) => {
                theorySlots.forEach(theorySlot => {
                    const labSlot = findMatchingLabSlot(theorySlot, labSlots);
                    if (!theorySlotMap.has(theorySlot)) theorySlotMap.set(theorySlot, []);
                    theorySlotMap.get(theorySlot)!.push({
                        facultyName,
                        ...(labSlot ? { facultyLabSlot: labSlot } : {}),
                    });
                });
                if (theorySlots.length === 0) {
                    labSlots.forEach(labSlot => {
                        if (!theorySlotMap.has(labSlot)) theorySlotMap.set(labSlot, []);
                        theorySlotMap.get(labSlot)!.push({ facultyName });
                    });
                }
            });

            result.push({
                id: `${course.courseCode}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                courseType: 'both',
                courseCode: course.courseCode,
                courseName: course.courseName,
                courseCodeLab: course.courseCode,
                courseNameLab: course.courseName,
                courseSlots: Array.from(theorySlotMap.entries()).map(([slotName, faculties]) => ({
                    slotName,
                    slotFaculties: faculties,
                })),
            });
        } else {
            const slotMap = new Map<string, Set<string>>();
            course.facultySlots.forEach(({ theorySlots, labSlots }, facultyName) => {
                const slots = courseType === 'lab' ? labSlots : theorySlots;
                slots.forEach(slot => {
                    if (!slotMap.has(slot)) slotMap.set(slot, new Set());
                    slotMap.get(slot)!.add(facultyName);
                });
            });

            result.push({
                id: `${course.courseCode}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                courseType,
                courseCode: course.courseCode,
                courseName: course.courseName,
                courseSlots: Array.from(slotMap.entries()).map(([slotName, facultySet]) => ({
                    slotName,
                    slotFaculties: Array.from(facultySet).map(facultyName => ({ facultyName })),
                })),
            });
        }
    });

    return result;
};

export default function CourseSelectionPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { timetableData, setTimetableData } = useTimetable();
    const { selectedScheme, setSelectedScheme } = usePreferences();
    
    // Feature Flag check
    const isSimplifiedEnabled = true; // Forced true for local testing

    // Local selections
    const [selectedOptions, setSelectedOptions] = useState<CourseOption[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCourseCode, setActiveCourseCode] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [allSubjectsMode, setAllSubjectsMode] = useState(false);
    const [disabledOptions, setDisabledOptions] = useState<Set<string>>(new Set());
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const { scheduleRows, leftTimes, rightTimes } = useMemo(() => getSlotViewPayload(), []);

    // Set scheme default
    useEffect(() => {
        if (!selectedScheme) {
            setSelectedScheme('CHENNAI');
        }
    }, [selectedScheme, setSelectedScheme]);

    // Load initial selections on mount
    useEffect(() => {
        const savedCoursesRaw = getPlannerStoredValue('preferenceCourses') || getPlannerStoredValue('generatedTimetableCourses');
        if (savedCoursesRaw) {
            try {
                const storedCourses = JSON.parse(savedCoursesRaw) as fullCourseData[];
                const loadedOptions: CourseOption[] = [];
                
                storedCourses.forEach(course => {
                    course.courseSlots.forEach(slot => {
                        slot.slotFaculties.forEach(fac => {
                            const tr = (chennaiCourses as any).find((r: any) => r.CODE === course.courseCode && r.SLOT === slot.slotName && r.FACULTY === fac.facultyName);
                            const lr = fac.facultyLabSlot ? (chennaiCourses as any).find((r: any) => r.CODE === course.courseCode && r.SLOT === fac.facultyLabSlot && r.FACULTY === fac.facultyName) : undefined;
                            
                            const type: 'th' | 'lab' | 'both' = (tr && lr) ? 'both' : lr ? 'lab' : 'th';
                            const credits = (tr?.CREDITS || 0) + (lr?.CREDITS || 0);

                            loadedOptions.push({
                                id: `${course.courseCode}_${fac.facultyName}_${slot.slotName}_${fac.facultyLabSlot || 'none'}`,
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                                facultyName: fac.facultyName,
                                theorySlot: tr ? slot.slotName : undefined,
                                labSlot: fac.facultyLabSlot || undefined,
                                credits,
                                type
                            });
                        });
                    });
                });

                setSelectedOptions(loadedOptions);
            } catch (err) {
                console.error("Failed to parse initial selections", err);
            }
        }
        setLoaded(true);
    }, []);

    // Synchronize to storage on change
    useEffect(() => {
        if (!loaded) return;

        const activeOptions = allSubjectsMode ? selectedOptions : selectedOptions.filter(opt => !disabledOptions.has(opt.id));
        const faculties = optionsToFacultyEntries(activeOptions);
        const facultyNames = faculties.map(f => f.facultyName);
        
        setPlannerStoredValue('preferenceMultipleFaculties', JSON.stringify(facultyNames));
        
        const updatedCourses = buildPreferenceCoursesFromRows(faculties);
        setPlannerStoredValue('preferenceCourses', JSON.stringify(updatedCourses));
        setPlannerStoredValue('generatedTimetableCourses', JSON.stringify(updatedCourses));
        
        // Regenerate timetable context
        const { result } = generateTT(updatedCourses);
        setTimetableData(result);
        setCurrentIndex(0); // Reset combination index
    }, [selectedOptions, disabledOptions, allSubjectsMode, loaded, setTimetableData]);

    // Unique courses list for search autocomplete
    const uniqueCourses = useMemo(() => {
        const map = new Map<string, { code: string; title: string }>();
        (chennaiCourses as any).forEach((record: any) => {
            if (!map.has(record.CODE)) {
                map.set(record.CODE, { code: record.CODE, title: record.TITLE });
            }
        });
        return Array.from(map.values());
    }, []);

    // Filtered search results
    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const query = searchTerm.toLowerCase();
        return uniqueCourses.filter(
            (c) => c.code.toLowerCase().includes(query) || c.title.toLowerCase().includes(query)
        ).slice(0, 8); // limit for overlay layout
    }, [uniqueCourses, searchTerm]);

    // Active course records
    const activeCourseRecords = useMemo(() => {
        if (!activeCourseCode) return [];
        const records = (chennaiCourses as any).filter((record: any) => record.CODE === activeCourseCode);
        
        // De-duplicate by FACULTY + SLOT + TYPE
        const seen = new Set<string>();
        const unique: any[] = [];
        records.forEach((r: any) => {
            const key = `${r.FACULTY?.trim()}|${r.SLOT?.trim()}|${r.TYPE?.trim()}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(r);
            }
        });
        return unique;
    }, [activeCourseCode]);

    // Active course name
    const activeCourseName = useMemo(() => {
        if (!activeCourseCode) return '';
        return activeCourseRecords[0]?.TITLE || '';
    }, [activeCourseCode, activeCourseRecords]);

    // Group active course records by faculty/slot into options
    const activeCourseOptions = useMemo(() => {
        if (activeCourseRecords.length === 0) return [];
        
        const facultyMap = new Map<string, any[]>();
        activeCourseRecords.forEach((r: any) => {
            if (!facultyMap.has(r.FACULTY)) {
                facultyMap.set(r.FACULTY, []);
            }
            facultyMap.get(r.FACULTY)!.push(r);
        });

        const options: CourseOption[] = [];

        facultyMap.forEach((facRecords, facultyName) => {
            const theoryRecords = facRecords.filter((r: any) => isTheoryType(r.TYPE));
            const labRecords = facRecords.filter((r: any) => isLabType(r.TYPE));

            if (theoryRecords.length > 0 && labRecords.length > 0) {
                const pairedLabSlots = new Set<string>();

                theoryRecords.forEach((tr: any) => {
                    const labSlots = labRecords.map((lr: any) => lr.SLOT);
                    const matchedLabSlotName = findMatchingLabSlot(tr.SLOT, labSlots);
                    const matchingLabRecord = labRecords.find((lr: any) => lr.SLOT === matchedLabSlotName);

                    if (matchingLabRecord) {
                        pairedLabSlots.add(matchingLabRecord.SLOT);
                        options.push({
                            id: `${tr.CODE}_${facultyName}_${tr.SLOT}_${matchingLabRecord.SLOT}`,
                            courseCode: tr.CODE,
                            courseName: tr.TITLE,
                            facultyName,
                            theorySlot: tr.SLOT,
                            labSlot: matchingLabRecord.SLOT,
                            type: 'both',
                            credits: tr.CREDITS + matchingLabRecord.CREDITS
                        });
                    } else {
                        options.push({
                            id: `${tr.CODE}_${facultyName}_${tr.SLOT}_none`,
                            courseCode: tr.CODE,
                            courseName: tr.TITLE,
                            facultyName,
                            theorySlot: tr.SLOT,
                            type: 'th',
                            credits: tr.CREDITS
                        });
                    }
                });

                labRecords.forEach((lr: any) => {
                    if (!pairedLabSlots.has(lr.SLOT)) {
                        options.push({
                            id: `${lr.CODE}_${facultyName}_none_${lr.SLOT}`,
                            courseCode: lr.CODE,
                            courseName: lr.TITLE,
                            facultyName,
                            labSlot: lr.SLOT,
                            type: 'lab',
                            credits: lr.CREDITS
                        });
                    }
                });
            } else if (theoryRecords.length > 0) {
                theoryRecords.forEach((tr: any) => {
                    options.push({
                        id: `${tr.CODE}_${facultyName}_${tr.SLOT}_none`,
                        courseCode: tr.CODE,
                        courseName: tr.TITLE,
                        facultyName,
                        theorySlot: tr.SLOT,
                        type: 'th',
                        credits: tr.CREDITS
                    });
                });
            } else if (labRecords.length > 0) {
                labRecords.forEach((lr: any) => {
                    options.push({
                        id: `${lr.CODE}_${facultyName}_none_${lr.SLOT}`,
                        courseCode: lr.CODE,
                        courseName: lr.TITLE,
                        facultyName,
                        labSlot: lr.SLOT,
                        type: 'lab',
                        credits: lr.CREDITS
                    });
                });
            }
        });

        return options;
    }, [activeCourseRecords]);

    // Live timetable generation combination details
    const currentCombination = useMemo(() => {
        return timetableData?.[currentIndex] || [];
    }, [timetableData, currentIndex]);

    const totalCombinations = useMemo(() => {
        return timetableData?.length || 0;
    }, [timetableData]);

    // Grid details for visual table rendering
    const theoryGrid: (timetableDisplayData | null)[][] = Array.from({ length: 5 }, () => Array(13).fill(null));
    const labGrid: (timetableDisplayData | null)[][] = Array.from({ length: 5 }, () => Array(13).fill(null));

    currentCombination.forEach(s => {
        const parts = s.slotName.split(/\+|__/);
        parts.forEach(p => {
            const cleanP = p.trim();
            scheduleRows.forEach((row, dayIdx) => {
                row.theoryLeft.forEach((cell, colIdx) => { if (cell.key === cleanP) theoryGrid[dayIdx][colIdx] = s; });
                row.theoryRight.forEach((cell, colIdx) => { if (cell.key === cleanP) theoryGrid[dayIdx][colIdx + 7] = s; });
                row.labLeft.forEach((cell, colIdx) => { if (cell.key === cleanP) labGrid[dayIdx][colIdx] = s; });
                row.labRight.forEach((cell, colIdx) => { if (cell.key === cleanP) labGrid[dayIdx][colIdx + 7] = s; });
            });
        });
    });

    // Check if slot is active/selected
    const isOptionSelected = (optId: string) => {
        return selectedOptions.some(o => o.id === optId);
    };

    // Toggle option
    const handleToggleOption = (opt: CourseOption) => {
        setSelectedOptions(prev => {
            const exists = prev.some(o => o.id === opt.id);
            if (exists) {
                return prev.filter(o => o.id !== opt.id);
            } else {
                // Clear other selections for the same course code to prevent duplicate registrations
                const filtered = prev.filter(o => o.courseCode !== opt.courseCode);
                return [...filtered, opt];
            }
        });
    };

    // Remove course selection
    const handleRemoveCourse = (courseCode: string) => {
        setSelectedOptions(prev => prev.filter(o => o.courseCode !== courseCode));
    };

    // Total credits selected
    const totalCredits = useMemo(() => {
        const activeOptions = allSubjectsMode ? selectedOptions : selectedOptions.filter(opt => !disabledOptions.has(opt.id));
        return activeOptions.reduce((acc, curr) => acc + curr.credits, 0);
    }, [selectedOptions, disabledOptions, allSubjectsMode]);

    const handleClearAll = () => {
        setSelectedOptions([]);
        setActiveCourseCode(null);
        setSearchTerm('');
    };

    const handleProceedToSave = () => {
        posthog.capture('proceed_to_save_clicked', {
            selected_courses_count: selectedOptions.length,
            total_credits: totalCredits
        });
        router.push('/timetable');
    };

    // If flag is disabled and loaded, redirect back to preferences
    useEffect(() => {
        if (isSimplifiedEnabled === false) {
            router.replace('/preferences');
        }
    }, [isSimplifiedEnabled, router]);

    if (!loaded || isSimplifiedEnabled === undefined) {
        return (
            <div className="min-h-screen bg-[#F5E6D3] flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[16px] font-bold text-gray-700">Loading planner...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5E6D3] font-sans flex flex-col pb-12">
            {/* Header */}
            <header className="w-full bg-[#FAFAFA]/90 backdrop-blur-md border-b border-[#eadcc5]/60 py-4 px-6 shrink-0 flex items-center justify-between shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/')}>
                        <Image src="/mic-logo.png" alt="MIC Logo" width={80} height={40} className="object-contain w-16 md:w-20 h-8 md:h-10" priority />
                        <span className="font-extrabold text-[20px] md:text-[24px] tracking-wider text-black select-none">FFCS</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="shrink-0 flex h-11 items-center gap-2 rounded-[10px] bg-[#D4F4E6] px-3 py-2 shadow-sm border border-emerald-300/30">
                        <span className="text-sm font-extrabold text-green-800 whitespace-nowrap">
                            Course Selection Mode
                        </span>
                        <button
                            type="button"
                            role="switch"
                            onClick={() => router.push('/preferences')}
                            aria-checked={true}
                            aria-label="Toggle course selection mode"
                            className="relative h-7 w-12 rounded-full shadow-inner transition-colors bg-emerald-500 focus:outline-none cursor-pointer"
                        >
                            <span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200 left-6 bg-white" />
                        </button>
                    </div>
                    {session?.user?.image ? (
                        <Image src={session.user.image} alt="avatar" width={32} height={32} className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-[#8B6E60] text-white font-bold flex items-center justify-center text-xs">
                            {session?.user?.name ? session.user.name[0].toUpperCase() : 'U'}
                        </div>
                    )}
                </div>
            </header>

            {/* Center Wrapper */}
            <div className="flex-1 w-full flex justify-center px-4 sm:px-6 py-6">
                {/* Single-column vertical stack */}
                <main className="w-full max-w-6xl flex flex-col gap-6">
                    
                    {/* Course Search Box */}
                    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-[#eaeaea]/80 flex flex-col gap-4 relative">
                        <div>
                            <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                Search & Add Courses
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">Type the course code or title (e.g. CSE1001 or Data Structures)</p>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by code or title..."
                                className="w-full bg-[#FAFAFA] border border-[#eadcc5]/80 rounded-2xl px-4 py-3.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]/60"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-lg font-medium"
                                >
                                    ✕
                                </button>
                            )}

                            {/* Search Results Dropdown Overlay */}
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#eadcc5]/80 rounded-2xl shadow-xl z-30 max-h-72 overflow-y-auto custom-scrollbar p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.code}
                                            onClick={() => {
                                                setActiveCourseCode(result.code);
                                                setSearchTerm('');
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-[#F5E6D3]/40 rounded-xl transition-colors flex flex-col gap-0.5 cursor-pointer"
                                        >
                                            <span className="font-bold text-xs text-[#3B5BDB] uppercase tracking-wider">{result.code}</span>
                                            <span className="font-bold text-sm text-gray-900 line-clamp-1">{result.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Course Selections */}
                    {activeCourseCode && (
                        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-[#eaeaea]/80 flex flex-col gap-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <span className="text-[10px] font-black tracking-wider text-[#3B5BDB] uppercase bg-[#3B5BDB]/10 px-2.5 py-1 rounded-full">{activeCourseCode}</span>
                                    <h3 className="text-lg font-bold text-black mt-2 leading-tight">{activeCourseName}</h3>
                                </div>
                                <button
                                    onClick={() => setActiveCourseCode(null)}
                                    className="text-xs font-bold text-gray-400 hover:text-red-500 cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="w-full h-px bg-gray-100" />

                            {/* Slot Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                                {activeCourseOptions.length === 0 ? (
                                    <p className="text-sm font-medium text-gray-400 text-center py-4 col-span-2">No faculties listed for this course.</p>
                                ) : (
                                    activeCourseOptions.map((opt) => {
                                        const isSelected = isOptionSelected(opt.id);
                                        return (
                                            <div
                                                key={opt.id}
                                                className={`w-full border rounded-2xl p-4 transition-all duration-300 flex items-center justify-between gap-3 ${
                                                    isSelected
                                                        ? 'bg-[#F4FBF7] border-[#D4F4E6] shadow-sm'
                                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-sm text-gray-900 truncate leading-tight">{opt.facultyName}</span>
                                                        <span className="text-[10px] font-bold text-[#8c6b5e] uppercase mt-0.5">
                                                            {opt.credits} Credits
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 mt-2.5">
                                                        {opt.theorySlot && (
                                                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[#E1F9E9] border border-[#c3f2d2] rounded-md text-emerald-800 flex items-center gap-1 w-max">
                                                                T: {opt.theorySlot}
                                                            </span>
                                                        )}
                                                        {opt.labSlot && (
                                                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[#FFF2BF] border border-[#fef08a] rounded-md text-amber-800 flex items-center gap-1 w-max">
                                                                L: {opt.labSlot}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleOption(opt)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-red-500 hover:bg-red-650 text-white'
                                                                : 'border border-[#3B5BDB] text-[#3B5BDB] hover:bg-[#3B5BDB]/5'
                                                        }`}
                                                    >
                                                        {isSelected ? 'Remove' : 'Select'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selected Courses Summary */}
                    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-[#eaeaea]/80 flex flex-col overflow-hidden">
                        <div className="bg-[#a9d6a9] px-6 md:px-8 py-4 flex justify-between items-center shrink-0">
                            <h2 className="text-2xl font-bold text-[#1f1f1f] flex items-center gap-2">
                                Selected Courses
                            </h2>
                        </div>

                        <div className="p-5 md:p-6 flex flex-col gap-4">
                            {/* List/Table */}
                        <div className="w-full overflow-x-auto custom-scrollbar">
                            {selectedOptions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center gap-2.5 py-6">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400" />
                                    <p className="text-sm font-semibold text-gray-400">No courses selected yet. Search above to begin!</p>
                                </div>
                            ) : (
                                <div className="min-w-[900px] flex flex-col h-full">
                                    <div className="grid grid-cols-[40px_50px_minmax(120px,1fr)_minmax(200px,1.4fr)_minmax(180px,1.2fr)_minmax(100px,1fr)_60px_60px] border-b border-[#ededed] bg-[#fcfcfc] text-[#1f1f1f] shrink-0">
                                        <div className="px-4 py-3 text-sm font-bold"></div>
                                        <div className="px-4 py-3 text-sm font-bold">No</div>
                                        <div className="px-4 py-3 text-sm font-bold">Course Code</div>
                                        <div className="px-4 py-3 text-sm font-bold">Course Name</div>
                                        <div className="px-4 py-3 text-sm font-bold">Faculty Name</div>
                                        <div className="px-4 py-3 text-sm font-bold">Slot</div>
                                        <div className="px-4 py-3 text-sm font-bold text-center">CR</div>
                                        <div className="px-4 py-3 text-sm font-bold text-right"></div>
                                    </div>
                                    <div className="flex-1 min-h-0 px-0">
                                        {selectedOptions.map((opt, index) => (
                                            <div
                                                key={opt.id}
                                                className={`grid grid-cols-[40px_50px_minmax(120px,1fr)_minmax(200px,1.4fr)_minmax(180px,1.2fr)_minmax(100px,1fr)_60px_60px] border-b border-[#f0f0f0] items-center transition-colors ${!allSubjectsMode && disabledOptions.has(opt.id) ? 'opacity-50 bg-gray-50' : 'bg-white hover:bg-[#f8f8f8]'}`}
                                            >
                                                <div className="px-4 py-4 flex items-center justify-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={allSubjectsMode || !disabledOptions.has(opt.id)}
                                                        onChange={(e) => {
                                                            setDisabledOptions(prev => {
                                                                const next = new Set(prev);
                                                                if (e.target.checked) next.delete(opt.id);
                                                                else next.add(opt.id);
                                                                return next;
                                                            });
                                                        }}
                                                        disabled={allSubjectsMode}
                                                        className="w-4 h-4 rounded border-gray-300 text-[#3B5BDB] focus:ring-[#3B5BDB] cursor-pointer disabled:cursor-not-allowed"
                                                    />
                                                </div>
                                                <div className="px-4 py-4 text-sm font-semibold text-[#1f1f1f]">{index + 1}</div>
                                                <div className="px-4 py-4 text-sm font-semibold font-mono text-[#1f1f1f]">{opt.courseCode}</div>
                                                <div className="px-4 py-4 text-sm leading-relaxed text-[#1f1f1f]">{opt.courseName}</div>
                                                <div className="px-4 py-4 text-sm leading-relaxed text-[#1f1f1f]">{opt.facultyName}</div>
                                                <div className="px-4 py-4 text-sm font-semibold text-[#1f1f1f]">
                                                    <div className="flex flex-col gap-0.5">
                                                        {opt.theorySlot && <span className="font-bold">T: {opt.theorySlot}</span>}
                                                        {opt.labSlot && <span className="font-bold">L: {opt.labSlot}</span>}
                                                    </div>
                                                </div>
                                                <div className="px-4 py-4 text-sm font-bold text-gray-700 text-center">{opt.credits}</div>
                                                <div className="px-4 py-4 flex items-center justify-end">
                                                    <button
                                                        onClick={() => handleRemoveCourse(opt.courseCode)}
                                                        className="text-gray-400 hover:text-red-500 cursor-pointer p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove course"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 6h18" />
                                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            <line x1="10" x2="10" y1="11" y2="17" />
                                                            <line x1="14" x2="14" y1="11" y2="17" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Controls & Credits */}
                        {selectedOptions.length > 0 && (
                            <div className="pt-4 mt-2 border-t border-gray-100 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
                                {/* Bottom Left: All Subjects Mode */}
                                <div className="flex-1 flex justify-start">
                                    <div className="flex items-center gap-2 bg-[#f2e6b5] rounded-xl px-3 py-2 shadow-[0_4px_10px_rgba(0,0,0,0.08)]">
                                        <span className="text-[13px] md:text-sm font-semibold text-[#1f1f1f]">All subjects mode</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsHelpOpen(true)}
                                            className="w-6 h-6 rounded-full bg-[#e6c44c] text-[#1f1f1f] font-bold text-xs shadow-inner grid place-items-center hover:brightness-95 transition"
                                            aria-label="All subjects mode info"
                                        >
                                            ?
                                        </button>
                                        <label className="relative inline-flex items-center cursor-pointer select-none ml-1">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={allSubjectsMode}
                                                onChange={(e) => setAllSubjectsMode(e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-white border border-[#d8d1a3] rounded-full peer-checked:bg-[#e6c44c] transition-colors duration-200"></div>
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-[#d8d1a3] rounded-full transition-all duration-200 peer-checked:translate-x-5 peer-checked:bg-white" />
                                        </label>
                                    </div>
                                </div>

                                {/* Center: Credits */}
                                <div className="shrink-0 flex items-center justify-center">
                                    <div className="flex items-center gap-3 text-black font-extrabold text-sm">
                                        <span>Total Selected Credits:</span>
                                        <span className="px-3.5 py-1.5 bg-[#E9D5FF] text-purple-800 rounded-full font-black text-xs border border-[#F2D8FE] shadow-sm">
                                            {totalCredits} Credits
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom Right: Delete All */}
                                <div className="flex-1 flex justify-end">
                                    <button
                                        onClick={handleClearAll}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 font-bold text-sm bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18" />
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                            <line x1="10" x2="10" y1="11" y2="17" />
                                            <line x1="14" x2="14" y1="11" y2="17" />
                                        </svg>
                                        Delete all
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                {/* Timetable Preview Box */}
                <div className="w-full flex flex-col gap-4 bg-white rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border border-[#eaeaea]/80">
                    
                    {/* Visual Preview Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 shrink-0 border-b border-gray-100 pb-4">
                        <div>
                            <h2 className="text-xl font-bold text-black flex items-center gap-2">
                                Timetable Preview
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">Updates instantly on selection changes</p>
                        </div>

                        {/* Combination Pagination */}
                        {totalCombinations > 0 && (
                            <div className="flex items-center gap-2 bg-[#FAFAFA] border border-gray-200/80 rounded-xl px-3 py-1.5">
                                <button
                                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentIndex === 0}
                                    className="p-1 text-gray-600 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed font-black"
                                >
                                    ◀
                                </button>
                                <span className="text-xs font-black text-gray-700 select-none">
                                    Option {currentIndex + 1} of {totalCombinations}
                                </span>
                                <button
                                    onClick={() => setCurrentIndex(prev => Math.min(totalCombinations - 1, prev + 1))}
                                    disabled={currentIndex === totalCombinations - 1}
                                    className="p-1 text-gray-600 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed font-black"
                                >
                                    ▶
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Table grid preview */}
                    <div className="w-full overflow-x-auto border border-gray-100 rounded-2xl bg-[#fbfbfb]">
                        {selectedOptions.length === 0 ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 gap-3">
                                <div className="w-16 h-16 bg-[#FFFCEE] border border-[#FFF3B0] rounded-full flex items-center justify-center text-2xl" />
                                <h3 className="font-bold text-gray-700">Your Timetable Grid is Empty</h3>
                                <p className="text-xs text-gray-400 max-w-xs">Select slots and faculty on the left to see them dynamically mapped into the schedule.</p>
                            </div>
                        ) : totalCombinations === 0 ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 gap-4 animate-lucid-fade-up">
                                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 text-red-500 text-2xl font-bold" />
                                <div className="flex flex-col gap-1.5">
                                    <h3 className="font-extrabold text-black">No Valid Combinations Found</h3>
                                    <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                                        Your selected courses are clashing in their timeslots. Try choosing a different faculty/slot combination.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-1.5 h-full">
                                <table className="w-full table-fixed border-collapse bg-white text-center min-w-[700px] text-xs h-full min-h-[340px]">
                                    <thead>
                                        <tr className="border-b-2 border-white h-8">
                                            <th className="text-center font-bold text-black border-r-2 border-white bg-[#FAFAFA] w-14 p-0.5 text-[9px] leading-tight">Theory Hours</th>
                                            {[...leftTimes, { theory: '', lab: '' }, ...rightTimes].map((t, i) => (
                                                <th key={i} className={`text-center font-bold text-black border-r-2 border-white bg-[#FAFAFA] ${i === 6 ? 'w-6 px-0' : 'p-0.5 text-[9px] leading-tight'}`}>
                                                    {t.theory ? t.theory.split('-').map((part, idx, arr) => (
                                                        <span key={idx} className="block whitespace-nowrap">{part}{idx < arr.length - 1 ? '-' : ''}</span>
                                                    )) : null}
                                                </th>
                                            ))}
                                        </tr>
                                        <tr className="border-b-2 border-white h-8">
                                            <th className="text-center font-bold text-black border-r-2 border-white bg-[#FAFAFA] w-14 p-0.5 text-[9px] leading-tight">Lab Hours</th>
                                            {[...leftTimes, { theory: '', lab: '' }, ...rightTimes].map((t, i) => (
                                                <th key={i} className={`text-center font-bold text-black border-r-2 border-white bg-[#FAFAFA] ${i === 6 ? 'w-6 px-0' : 'p-0.5 text-[9px] leading-tight'}`}>
                                                    {t.lab ? t.lab.split('-').map((part, idx, arr) => (
                                                        <span key={idx} className="block whitespace-nowrap">{part}{idx < arr.length - 1 ? '-' : ''}</span>
                                                    )) : null}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {scheduleRows.map((row, rowIdx) => (
                                            <tr key={row.day} className="h-14">
                                                <td className="text-black text-center align-middle border-r-2 border-white bg-[#FAFAFA] font-bold w-14 p-0 text-[9px]">{row.day}</td>
                                                {Array.from({ length: 13 }).map((_, colIdx) => {
                                                    if (colIdx === 6) {
                                                        const lunchLetters = ['L', 'U', 'N', 'C', 'H'];
                                                        return (
                                                            <td key="lunch-spacer" className="border-r-2 border-white align-middle bg-[#f8f9fa] w-6 p-0">
                                                                <div className="flex h-full flex-col items-center justify-center">
                                                                    <span className="font-black text-black opacity-80 text-[9px]">
                                                                        {lunchLetters[rowIdx]}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    }

                                                    const theoryCell = theoryGrid[rowIdx][colIdx];
                                                    const labCell = labGrid[rowIdx][colIdx];
                                                    const theoryBackgroundColor = theoryCell ? THEORY_FILLED_COLOR : THEORY_EMPTY_COLOR;
                                                    const labBackgroundColor = labCell ? LAB_FILLED_COLOR : LAB_EMPTY_COLOR;

                                                    let theoryLabel = '';
                                                    let labLabel = '';
                                                    if (colIdx < 6) {
                                                        theoryLabel = row.theoryLeft[colIdx].label;
                                                        labLabel = row.labLeft[colIdx].label;
                                                    } else {
                                                        theoryLabel = row.theoryRight[colIdx - 7].label;
                                                        labLabel = row.labRight[colIdx - 7].label;
                                                    }

                                                    return (
                                                        <td key={colIdx} className="align-top border-r-2 border-white p-0 bg-white">
                                                            <div className="grid w-full grid-rows-2 gap-0 h-full min-h-[64px]">
                                                                <div
                                                                    className={`relative flex flex-col items-center justify-center transition-all ${theoryCell ? 'z-10 py-1' : 'py-0'}`}
                                                                    style={{ backgroundColor: theoryBackgroundColor }}
                                                                >
                                                                    {theoryCell ? (
                                                                        <>
                                                                            <span className="font-black text-black text-[9px] leading-tight">{theoryLabel}</span>
                                                                            <span className="font-black text-[#1d5225] text-[7.5px] uppercase tracking-wide leading-tight max-w-[50px] truncate">{theoryCell.courseCode}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="font-bold text-[#4ea075] text-[9px] opacity-45">{theoryLabel}</span>
                                                                    )}
                                                                </div>

                                                                <div
                                                                    className={`relative flex flex-col items-center justify-center transition-all ${labCell ? 'z-10 py-1' : 'py-0'}`}
                                                                    style={{ backgroundColor: labBackgroundColor }}
                                                                >
                                                                    {labCell ? (
                                                                        <>
                                                                            <span className="font-black text-black text-[9px] leading-tight">{labLabel}</span>
                                                                            <span className="font-black text-[#665319] text-[7.5px] uppercase tracking-wide leading-tight max-w-[50px] truncate">{labCell.courseCode}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="font-bold text-[#d4a044] text-[9px] opacity-45">{labLabel}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Bottom Save & Proceed panel */}
                    <div className="shrink-0 flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={handleClearAll}
                            disabled={selectedOptions.length === 0}
                            className="px-5 py-3.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            Reset Selection
                        </button>
                        
                        <button
                            onClick={handleProceedToSave}
                            disabled={selectedOptions.length === 0 || totalCombinations === 0}
                            className="flex-1 max-w-sm px-6 py-4 bg-[#3B5BDB] border border-[#2b44ab] rounded-2xl text-sm font-black text-white hover:bg-[#2b44ab] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg hover:shadow-xl transition-all text-center flex items-center justify-center gap-2"
                        >
                            Proceed to Save & Export
                        </button>
                    </div>
                </div>
            </main>
            </div>
            {isHelpOpen && (
                <ModeHelpDialog
                    sections={ALL_SUBJECTS_MODE_HELP}
                    onClose={() => setIsHelpOpen(false)}
                />
            )}
            <style jsx>{`
                .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #7bcf86 #eeeeee; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #eeeeee; border-radius: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #7bcf86; border-radius: 6px; border: 1px solid #eeeeee; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6bc679; }
            `}</style>
        </div>
    );
}
