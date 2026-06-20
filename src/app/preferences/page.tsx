'use client';

/**
 * PREFERENCES PAGE — Multi-step wizard for timetable creation
 *
 * Flow: Landing → Login → Create New Timetable → **Preferences** → Courses → Timetable → Saved
 *
 * PURPOSE:
 * The user completes a 5-step wizard to set their preferences:
 *   1. Select Domain (e.g., BACSE, BAECE, BAEIE)
 *   2. Select Subject (specific courses from the selected domain)
 *   3. Select Slot (available time slots for the course)
 *   4. Select Faculty (professor for the course)
 *   5. Faculty Priority (set priority for faculty selection)
 *
 * DATABASE INTERACTIONS:
 * - No direct DB writes on this page
 * - Reads course catalog data from static data files
 * - Selected preferences are stored in PreferencesContext
 *
 * DATA FLOW:
 * - Input: Course catalog data (static imports from /data)
 * - Output: fullCourseData[] → passed to /courses page via context
 * - Uses: lib/PreferencesContext.tsx (state management)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useFeatureFlagEnabled } from '@posthog/react';
import posthog from 'posthog-js';
import { usePreferences } from '@/lib/PreferencesContext';
import { fullCourseData } from '@/lib/type';
import { getPlannerStoredValue, setPlannerStoredValue } from '@/lib/plannerStorage';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import ModeHelpDialog from '@/components/ModeHelpDialog';
import { PREFERENCE_TOUR_STEP_EVENT } from '@/components/plannerTourSteps';
import type { ChennaiDomainCatalog } from '@/lib/chennaiCatalog';
import {
    buildPreferenceCoursesFromChennaiSelection,
    getChennaiDepartmentData,
    chennaiCatalog,
} from '@/lib/chennaiCatalog';

// Cookie utility functions
const setCookie = (name: string, value: string, days = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
};

const deleteCookie = (name: string) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

const getCookie = (name: string): string | null => {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
};

const keepFirst = (arr: string[]): string[] => (arr.length > 0 ? [arr[0]] : []);

const SCHOOLS = ['SCOPE', 'SENSE', 'SELECT', 'SMEC', 'SCHEME', 'SCORE', 'SBST', 'SCE', 'SHINE', 'SSL', 'SAS'];

const SCHOOL_TO_DOMAINS: Record<string, string[]> = {
    SCOPE: ['BACSE'],
    SENSE: ['BECE', 'BAECE'],
    SELECT: ['BAEEE', 'BEEE'],
    SAS: ['BAMAT', 'BABIT'],
    SSL: ['BASTS', 'BSTS', 'STS', 'BAHUM', 'BAESP', 'BAFRE', 'BAGER', 'BAJAP'],
    SCE: ['BACLE'],
};

const STEP_COLORS_PALETTE = ['#9bc0f6', '#eedaff', '#d1fae5', '#9bc0f6', '#eedaff', '#d1fae5'];
const STEP_BORDER_COLORS_PALETTE = ['#759fdf', '#bfa1eb', '#9dcbb5', '#759fdf', '#bfa1eb', '#9dcbb5'];

const FACULTY_FIRST_MODE_COOKIE = 'facultyFirstPreferenceMode';
const FACULTY_FIRST_MODE_HELP = [
    {
        title: 'Faculty First Mode - ON',
        description: 'Choose the faculty before choosing a slot. The slot step will show only the slots available for that selected faculty.',
    },
    {
        title: 'Faculty First Mode - OFF',
        description: 'Use the existing flow: choose a slot first, then select one or more faculty available in that slot.',
    },
];

const selectionButtonClass = 'w-full p-3 lg:p-4 rounded-lg text-left font-semibold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:bg-white';
const selectionButtonSelectedClass = 'bg-white ring-2 ring-blue-500 shadow-md';
const selectionButtonUnselectedClass = 'bg-white/80 hover:bg-white hover:shadow-sm';

export default function PreferencesPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { addCourse, updateCourse } = usePreferences();
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const isFacultyFirstToggleAvailableRaw = useFeatureFlagEnabled(FEATURE_FLAGS.facultyFirstPreferenceFlow) ?? false;
    const isSchoolSelectionEnabledRaw = useFeatureFlagEnabled(FEATURE_FLAGS.schoolSelectionStep) ?? false;
    const isDirectJumpEnabledRaw = useFeatureFlagEnabled(FEATURE_FLAGS.directJumpToCourses) ?? false;

    const isFacultyFirstToggleAvailable = isMounted && isFacultyFirstToggleAvailableRaw;
    const isSchoolSelectionEnabled = isMounted && isSchoolSelectionEnabledRaw;
    const isDirectJumpEnabled = isMounted && isDirectJumpEnabledRaw;

    const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
    const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
    const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
    const [savedFacultyPreferences, setSavedFacultyPreferences] = useState<(string | { name: string; type: string })[]>([]);
    const [facultyPriority, setFacultyPriority] = useState<'slot' | 'faculty'>('slot');
    const [isFacultyFirstModeEnabled, setIsFacultyFirstModeEnabled] = useState(false);
    const [hasLoadedFacultyFirstMode, setHasLoadedFacultyFirstMode] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [selectionError, setSelectionError] = useState('');
    const [isSkippedToSubjects, setIsSkippedToSubjects] = useState(false);
    const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
    const isFacultyFirstMode = isFacultyFirstToggleAvailable && isFacultyFirstModeEnabled;

    useEffect(() => {
        setSubjectSearchQuery('');
    }, [currentStep]);

    const stepKeys = useMemo(() => {
        const keys = [];
        if (isSchoolSelectionEnabled) {
            keys.push('school');
        }
        keys.push('domain');
        keys.push('subject');
        if (isFacultyFirstMode) {
            keys.push('faculty');
            keys.push('slot');
        } else {
            keys.push('slot');
            keys.push('faculty');
        }
        keys.push('priority');
        return keys;
    }, [isSchoolSelectionEnabled, isFacultyFirstMode]);

    const stepLabels = useMemo(() => {
        return stepKeys.map(key => {
            switch (key) {
                case 'school': return 'Select School';
                case 'domain': return 'Select Domain';
                case 'subject': return 'Select Subject';
                case 'slot': return 'Select Slot';
                case 'faculty': return 'Select Faculty';
                case 'priority': return 'Faculty Priority';
                default: return '';
            }
        });
    }, [stepKeys]);

    const stepColors = useMemo(() => {
        return stepKeys.map((_, idx) => STEP_COLORS_PALETTE[idx % STEP_COLORS_PALETTE.length]);
    }, [stepKeys]);

    const stepBorderColors = useMemo(() => {
        return stepKeys.map((_, idx) => STEP_BORDER_COLORS_PALETTE[idx % STEP_BORDER_COLORS_PALETTE.length]);
    }, [stepKeys]);

    const moveFacultyUp = (index: number) => {
        if (index === 0) return;
        const updated = [...savedFacultyPreferences];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        setSavedFacultyPreferences(updated);
    };

    const moveFacultyDown = (index: number) => {
        if (index === savedFacultyPreferences.length - 1) return;
        const updated = [...savedFacultyPreferences];
        [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
        setSavedFacultyPreferences(updated);
    };
    const hasRestoredRef = React.useRef(false);
    // Load preferences from cookies on mount
    useEffect(() => {
        if (hasRestoredRef.current) return;
        posthog.capture('preferences_flow_started');
        const timer = window.setTimeout(() => {
            const savedStep = getCookie('preferenceStep');
            const savedStepKey = getCookie('preferenceStepKey');
            const savedSchool = getCookie('preferenceSchool');
            const savedDomains = getCookie('preferenceDomains');
            const savedSubjects = getCookie('preferenceSubjects');
            const savedSlots = getCookie('preferenceSlots');
            const savedFaculties = getPlannerStoredValue('preferenceMultipleFaculties');
            const savedPriority = getCookie('facultyPriority');
            const savedFacultyFirstMode = getCookie(FACULTY_FIRST_MODE_COOKIE);
            const savedSkipped = getCookie('preferenceIsSkippedToSubjects');

            if (savedSchool) setSelectedSchool(savedSchool);
            if (savedDomains) {
                const parsed = JSON.parse(savedDomains);
                setSelectedDomains(keepFirst(Array.isArray(parsed) ? parsed : []));
            }
            if (savedSubjects) {
                const parsed = JSON.parse(savedSubjects);
                setSelectedSubjects(keepFirst(Array.isArray(parsed) ? parsed : []));
            }
            if (savedSlots) setSelectedSlots(JSON.parse(savedSlots));
            if (savedFaculties) setSavedFacultyPreferences(JSON.parse(savedFaculties));
            if (savedPriority) setFacultyPriority(savedPriority as 'slot' | 'faculty');
            if (savedFacultyFirstMode === 'true') setIsFacultyFirstModeEnabled(true);
            if (savedSkipped === 'true') setIsSkippedToSubjects(true);
            setHasLoadedFacultyFirstMode(true);

            let stepRestored = false;
            if (savedStepKey) {
                const stepIdx = stepKeys.indexOf(savedStepKey);
                if (stepIdx !== -1) {
                    setCurrentStep(stepIdx + 1);
                    stepRestored = true;
                }
            }
            if (!stepRestored && savedStep) {
                const parsedStep = Number.parseInt(savedStep, 10);
                if (!Number.isNaN(parsedStep) && parsedStep >= 1 && parsedStep <= stepKeys.length) {
                    setCurrentStep(parsedStep);
                }
            }
            hasRestoredRef.current = true;
        }, 0);

        return () => window.clearTimeout(timer);
    }, [stepKeys]);

    // Save preferences to cookies whenever they change
    useEffect(() => {
        setCookie('preferenceStep', currentStep.toString());
        if (stepKeys[currentStep - 1]) {
            setCookie('preferenceStepKey', stepKeys[currentStep - 1]);
        }
        setCookie('preferenceSchool', selectedSchool || '');
        setCookie('preferenceDomains', JSON.stringify(selectedDomains));
        setCookie('preferenceSubjects', JSON.stringify(selectedSubjects));
        setCookie('preferenceSlots', JSON.stringify(selectedSlots));
        setCookie('facultyPriority', facultyPriority);
        setCookie('preferenceIsSkippedToSubjects', isSkippedToSubjects ? 'true' : 'false');
    }, [currentStep, selectedSchool, selectedDomains, selectedSubjects, selectedSlots, facultyPriority, stepKeys, isSkippedToSubjects]);

    useEffect(() => {
        if (!hasLoadedFacultyFirstMode) return;
        setCookie(FACULTY_FIRST_MODE_COOKIE, isFacultyFirstModeEnabled ? 'true' : 'false');
    }, [hasLoadedFacultyFirstMode, isFacultyFirstModeEnabled]);

    useEffect(() => {
        setPlannerStoredValue('preferenceMultipleFaculties', JSON.stringify(savedFacultyPreferences));
    }, [savedFacultyPreferences]);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsVisible(true), 40);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleTourStep = (event: Event) => {
            const step = (event as CustomEvent<{ step?: number }>).detail?.step;
            if (typeof step === 'number' && step >= (isSchoolSelectionEnabled ? 0 : 1) && step <= 5) {
                const adjustedStep = isSchoolSelectionEnabled ? step + 1 : step;
                setCurrentStep(adjustedStep);
            }
        };

        window.addEventListener(PREFERENCE_TOUR_STEP_EVENT, handleTourStep);
        return () => window.removeEventListener(PREFERENCE_TOUR_STEP_EVENT, handleTourStep);
    }, [isSchoolSelectionEnabled]);



    // Load Chennai domain data dynamically
    const domainData = useMemo<ChennaiDomainCatalog>(() => {
        return getChennaiDepartmentData(selectedDomains);
    }, [selectedDomains]);

    // Get available domains (course prefixes)
    const domains = useMemo(() => {
        const allDomains = Object.keys(getChennaiDepartmentData([]));
        if (isSchoolSelectionEnabled && selectedSchool) {
            const allowedDomains = SCHOOL_TO_DOMAINS[selectedSchool] || [];
            return allDomains.filter((domain) => allowedDomains.includes(domain));
        }
        return allDomains;
    }, [isSchoolSelectionEnabled, selectedSchool]);

    // Get subjects in selected domain
    const subjects = useMemo(() => {
        if (isSkippedToSubjects) {
            const allSubjects = Object.values(chennaiCatalog).flatMap((subjectsObj) => Object.keys(subjectsObj));
            return [...new Set(allSubjects)].sort();
        }
        if (selectedDomains.length === 0 || !domainData) return [];
        const allSubjects = selectedDomains.flatMap((domain) => Object.keys(domainData[domain] ?? {}));
        return [...new Set(allSubjects)];
    }, [selectedDomains, domainData, isSkippedToSubjects]);

    const filteredSubjectsInStep = useMemo(() => {
        const query = subjectSearchQuery.toLowerCase().trim();
        if (!query) {
            return isSkippedToSubjects ? subjects.slice(0, 50) : subjects;
        }
        return subjects.filter(
            s => s.toLowerCase().includes(query)
        );
    }, [subjects, subjectSearchQuery, isSkippedToSubjects]);

    // Get slots for selected subject, narrowed to the active faculty in faculty-first mode.
    const slots = useMemo(() => {
        if (selectedSubjects.length === 0 || selectedDomains.length === 0 || !domainData) return [];
        const slotSet = new Set<string>();
        const activeFaculty = isFacultyFirstMode ? selectedFaculties[0] : undefined;

        selectedDomains.forEach(domain => {
            const subjectMap = domainData[domain] || {};
            selectedSubjects.forEach(subject => {
                const subjectData = subjectMap[subject] || [];
                subjectData.forEach((item) => {
                    if (activeFaculty && item.FACULTY !== activeFaculty) return;
                    if (item.SLOT) slotSet.add(item.SLOT);
                });
            });
        });
        return Array.from(slotSet);
    }, [selectedSubjects, selectedDomains, domainData, isFacultyFirstMode, selectedFaculties]);

    // Slot type map: theory (ETH/TH) vs lab (ELA/LO) — used for labels in Step 3
    const slotTypes = useMemo<Record<string, 'theory' | 'lab' | 'other'>>(() => {
        if (selectedSubjects.length === 0 || selectedDomains.length === 0 || !domainData) return {};
        const map: Record<string, 'theory' | 'lab' | 'other'> = {};
        selectedDomains.forEach(domain => {
            const subjectMap = domainData[domain] || {};
            selectedSubjects.forEach(subject => {
                const items = subjectMap[subject] || [];
                items.forEach(item => {
                    if (!item.SLOT) return;
                    const t = item.TYPE.toUpperCase().trim();
                    if (['ETH', 'TH', 'PJT', 'SS', 'OC', 'EPJ'].includes(t)) {
                        map[item.SLOT] = 'theory';
                    } else if (['ELA', 'LO'].includes(t)) {
                        map[item.SLOT] = map[item.SLOT] === 'theory' ? 'theory' : 'lab';
                    } else {
                        map[item.SLOT] = map[item.SLOT] || 'other';
                    }
                });
            });
        });
        return map;
    }, [selectedSubjects, selectedDomains, domainData]);

    // Get faculties for the selected subject. Normal mode narrows by slot; faculty-first mode lists all subject faculty.
    const faculties = useMemo<string[]>(() => {
        if (selectedSubjects.length === 0 || selectedDomains.length === 0 || !domainData) return [];
        if (!isFacultyFirstMode && selectedSlots.length === 0) return [];
        const facultySet = new Set<string>();

        selectedDomains.forEach(domain => {
            const subjectMap = domainData[domain] || {};
            selectedSubjects.forEach(subject => {
                const subjectData = subjectMap[subject] || [];
                subjectData.forEach((item) => {
                    if (isFacultyFirstMode || selectedSlots.includes(item.SLOT)) {
                        if (item.FACULTY) facultySet.add(item.FACULTY);
                    }
                });
            });
        });

        return Array.from(facultySet);
    }, [selectedSubjects, selectedDomains, selectedSlots, domainData, isFacultyFirstMode]);

    const handleNext = () => {
        posthog.capture('preference_step_completed', { step: currentStep });
        if (currentStep === stepKeys.length - 1) {
            const persisted = persistCurrentSelection(false);
            if (persisted) {
                setCurrentStep(stepKeys.length);
            }
            return;
        }

        if (currentStep < stepKeys.length) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep === 3 && isSkippedToSubjects) {
            setCurrentStep(1);
            setIsSkippedToSubjects(false);
            return;
        }
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleStepClick = (stepNum: number) => {
        if (stepNum >= 1 && stepNum <= stepKeys.length) {
            if (isSkippedToSubjects && stepNum < 3) {
                setIsSkippedToSubjects(false);
            }
            setCurrentStep(stepNum);
        }
    };

    const handleFacultyFirstModeToggle = () => {
        setSelectionError('');
        setIsFacultyFirstModeEnabled(prev => !prev);
        setSelectedSlots([]);

        setSelectedFaculties(prev => {
            if (selectedSubjects.length === 0 || selectedDomains.length === 0 || !domainData) {
                return prev;
            }

            const validFaculties = new Set<string>();
            selectedDomains.forEach(domain => {
                const subjectMap = domainData[domain] || {};
                selectedSubjects.forEach(subject => {
                    const subjectData = subjectMap[subject] || [];
                    subjectData.forEach(item => {
                        if (item.FACULTY) validFaculties.add(item.FACULTY);
                    });
                });
            });

            return prev.filter(faculty => validFaculties.has(faculty));
        });

        const subjectIdx = stepKeys.indexOf('subject');
        if (currentStep > subjectIdx + 1) {
            setCurrentStep(subjectIdx + 2);
        }
    };

    const handleFacultyFirstModeHelp = () => {
        setIsHelpOpen(true);
    };

    const handleAddAnotherProfessor = () => {
        setSelectionError('');
        setSelectedSubjects([]);
        setSelectedSlots([]);
        setSelectedFaculties([]);
        const targetStep = isSkippedToSubjects
            ? stepKeys.indexOf('subject') + 1
            : stepKeys.indexOf('domain') + 1;
        setCurrentStep(targetStep);
        setCookie('preferenceStep', targetStep.toString());
    };

    const handleSchoolSelect = React.useCallback((school: string, autoAdvance = true) => {
        setSelectionError('');
        setSelectedSchool(school);

        if (selectedSchool !== school) {
            setSelectedDomains([]);
            setSelectedSubjects([]);
            setSelectedSlots([]);
            setSelectedFaculties([]);
        }

        if (autoAdvance) {
            setTimeout(() => setCurrentStep(stepKeys.indexOf('domain') + 1), 200);
        }
    }, [selectedSchool, stepKeys]);

    const handleDomainSelect = React.useCallback((domain: string, autoAdvance = true) => {
        setSelectionError('');

        setSelectedDomains([domain]);

        if (selectedDomains[0] !== domain) {
            setSelectedSubjects([]);
            setSelectedSlots([]);
            setSelectedFaculties([]);
        }

        if (autoAdvance) {
            setTimeout(() => setCurrentStep(stepKeys.indexOf('subject') + 1), 200);
        }
    }, [selectedDomains, stepKeys]);

    const handleSubjectSelect = React.useCallback((subject: string, autoAdvance = true) => {
        setSelectionError('');
        
        setSelectedSubjects([subject]);
        
        if (selectedSubjects[0] !== subject) {
            setSelectedSlots([]);
            setSelectedFaculties([]);
        }

        if (isSkippedToSubjects) {
            const code = subject.split(' - ')[0];
            const match = code.match(/^[A-Z]+/);
            const domain = match?.[0] || '';
            setSelectedDomains([domain]);
        }

        if (autoAdvance) {
            setTimeout(() => setCurrentStep(3), 200);
        }
    }, [selectedSubjects, isSkippedToSubjects]);

    const handleSlotSelect = React.useCallback((slot: string, autoAdvance = true) => {
        setSelectionError('');
        setSelectedSlots([slot]);
        
        if (!isFacultyFirstMode && selectedSlots[0] !== slot) {
            setSelectedFaculties([]);
        }

        if (autoAdvance) {
            setTimeout(() => setCurrentStep(4), 200);
        }
    }, [isFacultyFirstMode, selectedSlots]);

    const handleFacultySelect = React.useCallback((faculty: string, autoAdvance = true) => {
        setSelectionError('');

        if (isFacultyFirstMode) {
            setSelectedFaculties([faculty]);
            if (selectedFaculties[0] !== faculty) {
                setSelectedSlots([]);
            }
            return;
        }
        
        if (!autoAdvance) {
            // Keyboard navigation: strictly single-select to keep the "one selection" visual
            setSelectedFaculties([faculty]);
        } else {
            // Mouse click or manual Enter: toggle multi-select
            setSelectedFaculties(prev =>
                prev.includes(faculty) ? prev.filter(f => f !== faculty) : [...prev, faculty]
            );
            
            // If the user hits Enter on a button that's already selected, it could mean they want to proceed.
            // But for now, let's just let them toggle. 
            // If autoAdvance is true and they are in Step 4, handleNext() was previously called.
            // Let's only auto-advance if they press Next or if we want to be aggressive.
            // The user said: "if the user clicks two or more faculty... let them move to the next section"
            // I'll leave the auto-advance for faculty selection to be manual (via Next button) 
            // OR we can make it so that if they've selected some and click an already selected one, it advances?
            // Actually, let's keep it simple: manual Next for multi-select.
        }
    }, [isFacultyFirstMode, selectedFaculties]);

    const persistCurrentSelection = React.useCallback((resetWizard = true) => {
        if (selectedSubjects.length > 0 && selectedSlots.length > 0 && selectedFaculties.length > 0) {
            setSelectionError('');
            const newCourses = buildPreferenceCoursesFromChennaiSelection(
                selectedDomains,
                selectedSubjects,
                selectedSlots,
                selectedFaculties,
            );

            if (newCourses.length > 0) {
                let existingCourses: fullCourseData[] = [];

                try {
                    const existingCoursesRaw = getPlannerStoredValue('preferenceCourses');
                    existingCourses = existingCoursesRaw ? JSON.parse(existingCoursesRaw) : [];
                } catch (error) {
                    console.error('Error reading preferenceCourses cookie:', error);
                }

                const existingEntries = new Set(
                    existingCourses.flatMap(course =>
                        course.courseSlots.flatMap(courseSlot =>
                            courseSlot.slotFaculties.map(faculty => `${course.courseCode}||${courseSlot.slotName}||${faculty.facultyName}`)
                        )
                    )
                );

                const duplicateEntry = newCourses.flatMap(course =>
                    course.courseSlots.flatMap(courseSlot =>
                        courseSlot.slotFaculties.map(faculty => ({
                            key: `${course.courseCode}||${courseSlot.slotName}||${faculty.facultyName}`,
                            courseCode: course.courseCode,
                            courseName: course.courseName,
                            slotName: courseSlot.slotName,
                            facultyName: faculty.facultyName,
                        }))
                    )
                ).find(entry => existingEntries.has(entry.key));

                if (duplicateEntry) {
                    setSelectionError(
                        `${duplicateEntry.facultyName} is already added for ${duplicateEntry.courseCode} (${duplicateEntry.slotName}).`
                    );
                    return false;
                }

                // Merge-on-add: if adding a lab entry for a course that already has a theory entry
                // (or vice versa), merge them into a single 'both' entry.
                const finalNewCourses: fullCourseData[] = [];
                let mergedExistingCourses = [...existingCourses];

                for (const newCourse of newCourses) {
                    if (newCourse.courseType === 'lab') {
                        const theoryIdx = mergedExistingCourses.findIndex(
                            c => c.courseCode === newCourse.courseCode && (c.courseType === 'th' || c.courseType === 'both')
                        );
                        if (theoryIdx !== -1) {
                            const theoryCourse = mergedExistingCourses[theoryIdx];
                            const labSlot = newCourse.courseSlots[0];
                            if (labSlot) {
                                const mergedCourse: fullCourseData = {
                                    ...theoryCourse,
                                    courseType: 'both',
                                    courseCodeLab: newCourse.courseCode,
                                    courseNameLab: newCourse.courseName,
                                    courseSlots: theoryCourse.courseSlots.map(cs => ({
                                        ...cs,
                                        slotFaculties: cs.slotFaculties.map(f => {
                                            const match = labSlot.slotFaculties.find(lf => lf.facultyName === f.facultyName);
                                            return match ? { ...f, facultyLabSlot: labSlot.slotName } : f;
                                        }),
                                    })),
                                };
                                mergedExistingCourses = [
                                    ...mergedExistingCourses.slice(0, theoryIdx),
                                    mergedCourse,
                                    ...mergedExistingCourses.slice(theoryIdx + 1),
                                ];
                                updateCourse(theoryCourse.courseCode, mergedCourse);
                                continue; // Skip adding lab as separate entry
                            }
                        }
                    } else if (newCourse.courseType === 'th') {
                        const labIdx = mergedExistingCourses.findIndex(
                            c => c.courseCode === newCourse.courseCode && c.courseType === 'lab'
                        );
                        if (labIdx !== -1) {
                            const labCourse = mergedExistingCourses[labIdx];
                            const labSlot = labCourse.courseSlots[0];
                            if (labSlot) {
                                const mergedCourse: fullCourseData = {
                                    ...newCourse,
                                    courseType: 'both',
                                    courseCodeLab: labCourse.courseCode,
                                    courseNameLab: labCourse.courseName,
                                    courseSlots: newCourse.courseSlots.map(cs => ({
                                        ...cs,
                                        slotFaculties: cs.slotFaculties.map(f => {
                                            const match = labSlot.slotFaculties.find(lf => lf.facultyName === f.facultyName);
                                            return match ? { ...f, facultyLabSlot: labSlot.slotName } : f;
                                        }),
                                    })),
                                };
                                // Remove old lab entry, add merged theory entry
                                mergedExistingCourses = mergedExistingCourses.filter((_, i) => i !== labIdx);
                                mergedExistingCourses.push(mergedCourse);
                                addCourse(mergedCourse); // context: add merged (lab entry will be removed next)
                                updateCourse(labCourse.courseCode, mergedCourse);
                                continue;
                            }
                        }
                    }
                    finalNewCourses.push(newCourse);
                }

                finalNewCourses.forEach(c => addCourse(c));

                try {
                    let updatedExistingCourses = [...mergedExistingCourses];

                    finalNewCourses.forEach(course => {
                        updatedExistingCourses = updatedExistingCourses.filter(existing => existing.id !== course.id);
                        updatedExistingCourses.push(course);
                    });

                    setPlannerStoredValue('preferenceCourses', JSON.stringify(updatedExistingCourses));
                } catch (error) {
                    console.error('Error saving preferenceCourses cookie:', error);
                    setPlannerStoredValue('preferenceCourses', JSON.stringify(finalNewCourses));
                }

                setSavedFacultyPreferences(prev => {
                    const merged = [...prev];
                    const currentType = selectedSlots[0] ? (slotTypes[selectedSlots[0]] || 'theory') : 'theory';
                    selectedFaculties.forEach(faculty => {
                        const exists = merged.some(f => 
                            (typeof f === 'string' ? f : f.name) === faculty
                        );
                        if (!exists) {
                            merged.push({ name: faculty, type: currentType });
                        }
                    });
                    return merged;
                });
            }

            if (resetWizard) {
                setSelectedSubjects([]);
                setSelectedSlots([]);
                setSelectedFaculties([]);
                setSelectedSchool(null);
                setCurrentStep(1);
            } else {
                setSelectedFaculties([]);
            }

            return true;
        }

        return false;
    }, [addCourse, selectedDomains, selectedFaculties, selectedSlots, selectedSubjects, slotTypes, updateCourse]);

    const canProceed = () => {
        const stepKey = stepKeys[currentStep - 1];
        switch (stepKey) {
            case 'school':
                return selectedSchool !== null;
            case 'domain':
                return selectedDomains.length > 0;
            case 'subject':
                return selectedSubjects.length > 0;
            case 'slot':
                return selectedSlots.length > 0;
            case 'faculty':
                return selectedFaculties.length > 0;
            case 'priority':
                return savedFacultyPreferences.length > 0;
            default:
                return false;
        }
    };

    // Keyboard navigation to scroll to items starting with pressed key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const key = e.key.toLowerCase();
            const stepKey = stepKeys[currentStep - 1];
            let itemsToSearch: string[] = [];
            if (stepKey === 'school') itemsToSearch = SCHOOLS;
            else if (stepKey === 'domain') itemsToSearch = domains;
            else if (stepKey === 'subject') itemsToSearch = filteredSubjectsInStep;
            else if (stepKey === 'slot') itemsToSearch = slots;
            else if (stepKey === 'faculty') itemsToSearch = faculties;

            if (key === 'enter') {
                if (stepKey === 'school' && selectedSchool) {
                    e.preventDefault();
                    setCurrentStep(stepKeys.indexOf('domain') + 1);
                    return;
                }
                if (stepKey === 'domain' && selectedDomains.length > 0) {
                    e.preventDefault();
                    setCurrentStep(stepKeys.indexOf('subject') + 1);
                    return;
                }
                if (stepKey === 'subject' && selectedSubjects.length > 0) {
                    e.preventDefault();
                    setCurrentStep(stepKeys.indexOf(isFacultyFirstMode ? 'faculty' : 'slot') + 1);
                    return;
                }
                if (stepKey === (isFacultyFirstMode ? 'faculty' : 'slot') && (isFacultyFirstMode ? selectedFaculties.length > 0 : selectedSlots.length > 0)) {
                    e.preventDefault();
                    setCurrentStep(stepKeys.indexOf(isFacultyFirstMode ? 'slot' : 'faculty') + 1);
                    return;
                }
                if (stepKey === (isFacultyFirstMode ? 'slot' : 'faculty')) {
                    const hasFinalSelection = isFacultyFirstMode ? selectedSlots.length > 0 : selectedFaculties.length > 0;
                    if (hasFinalSelection) {
                        e.preventDefault();
                        const persisted = persistCurrentSelection(false);
                        if (persisted) setCurrentStep(stepKeys.indexOf('priority') + 1);
                    }
                    return;
                }
                return;
            }

            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                if (itemsToSearch.length === 0) return;
                e.preventDefault();

                const activeElement = document.activeElement as HTMLButtonElement;
                const currentIndex = itemsToSearch.findIndex(item => itemRefs.current[item] === activeElement);
                let nextIndex = 0;

                if (currentIndex !== -1) {
                    if (key === 'arrowdown' || key === 'arrowright') {
                        nextIndex = Math.min(itemsToSearch.length - 1, currentIndex + 1);
                    } else if (key === 'arrowup' || key === 'arrowleft') {
                        nextIndex = Math.max(0, currentIndex - 1);
                    }
                }

                const targetItem = itemsToSearch[nextIndex];
                if (targetItem && itemRefs.current[targetItem]) {
                    itemRefs.current[targetItem].focus();
                    itemRefs.current[targetItem].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                    if (stepKey === 'school') handleSchoolSelect(targetItem, false);
                    else if (stepKey === 'domain') handleDomainSelect(targetItem, false);
                    else if (stepKey === 'subject') handleSubjectSelect(targetItem, false);
                    else if (stepKey === 'slot') handleSlotSelect(targetItem, false);
                    else if (stepKey === 'faculty') handleFacultySelect(targetItem, false);
                }
                return;
            }

            if (key.length === 1 && /[a-z]/.test(key)) {
                const targetItem = itemsToSearch.find(item => item.toLowerCase().startsWith(key));
                if (targetItem && itemRefs.current[targetItem]) {
                    itemRefs.current[targetItem].focus();
                    itemRefs.current[targetItem].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                    if (stepKey === 'school') handleSchoolSelect(targetItem, false);
                    else if (stepKey === 'domain') handleDomainSelect(targetItem, false);
                    else if (stepKey === 'subject') handleSubjectSelect(targetItem, false);
                    else if (stepKey === 'slot') handleSlotSelect(targetItem, false);
                    else if (stepKey === 'faculty') handleFacultySelect(targetItem, false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        currentStep,
        stepKeys,
        domains,
        filteredSubjectsInStep,
        slots,
        faculties,
        selectedSchool,
        selectedDomains,
        selectedSubjects,
        selectedSlots,
        selectedFaculties,
        isFacultyFirstMode,
        handleSchoolSelect,
        handleDomainSelect,
        handleSubjectSelect,
        handleFacultySelect,
        handleSlotSelect,
        persistCurrentSelection,
    ]);

    const getTourStepName = (stepNum: number) => {
        if (isSchoolSelectionEnabled) {
            if (stepNum === 1) return 'preferences-step-school';
            return `preferences-step-${stepNum - 1}`;
        }
        return `preferences-step-${stepNum}`;
    };

    return (
        <>
        <div className={`h-screen bg-[#F5E6D3] font-sans overflow-hidden transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="h-full px-[clamp(12px,1.5vw,24px)] pt-[clamp(10px,1vh,18px)] pb-29">
                <div className="w-full max-w-450 h-full mx-auto flex flex-col min-h-0">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 pt-6 pb-3 shrink-0">
                        <h1 data-tour="preferences-intro" className="text-[26px] lg:text-3xl font-bold text-black text-center md:text-left animate-lucid-fade-up">Select Your Preferences</h1>
                        {isFacultyFirstToggleAvailable && (
                            <div data-tour="preferences-faculty-first-mode" className="shrink-0 flex h-11 items-center gap-2 rounded-[10px] bg-[#F6E9AB] px-3 py-2 shadow-sm">
                                <span className="text-sm font-extrabold text-gray-900 whitespace-nowrap">
                                    Faculty first mode
                                </span>
                                <button
                                    type="button"
                                    onClick={handleFacultyFirstModeHelp}
                                    aria-label="What is faculty first mode?"
                                    title="What is faculty first mode?"
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F0C73C] font-extrabold leading-none text-gray-900 shadow-sm transition-colors hover:bg-[#E6B829] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                                >
                                    ?
                                </button>
                                <button
                                    type="button"
                                    role="switch"
                                    onClick={handleFacultyFirstModeToggle}
                                    aria-checked={isFacultyFirstMode}
                                    aria-label="Toggle faculty first mode"
                                    className={`relative h-7 w-12 rounded-full shadow-inner transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                                        isFacultyFirstMode ? 'bg-[#F0C73C]' : 'bg-white'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200 ${
                                            isFacultyFirstMode
                                                ? 'left-6 bg-white'
                                                : 'left-1 bg-[#D8CF96]'
                                        }`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white overflow-hidden px-4 py-4 lg:px-6 lg:py-5 animate-lucid-fade-up-delayed">
                            <div className="flex items-stretch gap-[clamp(8px,0.9vw,16px)] h-full min-h-0 min-w-0 overflow-hidden" style={{ scrollBehavior: 'smooth' }}>
                        {/* Step Panels */}
                        {stepKeys.map((stepKey, idx) => {
                            const stepNum = idx + 1;
                            return (
                                <div
                                    key={stepNum}
                                    data-tour={stepNum === currentStep ? getTourStepName(stepNum) : undefined}
                                    onClick={stepNum === currentStep ? undefined : () => handleStepClick(stepNum)}
                                    className={`rounded-2xl items-center justify-center transition-all duration-300 overflow-hidden shrink-0 ${
                                        stepNum === currentStep
                                            ? 'flex flex-1 md:flex-[2.8] w-full md:w-auto min-w-[200px] md:min-w-70 max-w-full md:max-w-117.5'
                                            : 'hidden md:flex flex-1 min-w-14.5'
                                    }`}
                                    style={{ backgroundColor: stepColors[idx] }}
                                >
                                {stepNum === currentStep ? (
                                    <div key={`active-step-${stepKey}`} className="w-full h-full flex flex-col px-2 lg:px-4 pt-4 pb-3 overflow-hidden bg-white/10 backdrop-blur-sm rounded-2xl animate-lucid-panel-in">
                                        <div 
                                            className="flex items-center justify-center shrink-0 border-b-4 pb-3 mb-3 px-2 lg:-mx-4 lg:px-4"
                                            style={{ borderBottomColor: stepBorderColors[idx] }}
                                        >
                                            <h2 className="text-[16px] lg:text-[28px] font-bold text-black m-0 leading-none text-center">
                                                {stepNum}. {stepLabels[idx]}
                                            </h2>
                                        </div>

                                        <div className="flex-1 bg-transparent p-1 lg:p-3 overflow-y-auto custom-scrollbar flex flex-col">
                                            {selectionError && (
                                                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                                    {selectionError}
                                                </div>
                                            )}
                                            {/* Step: School Selection */}
                                            {stepKey === 'school' && (
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                                                        Select one option
                                                    </p>
                                                    {isDirectJumpEnabled && (
                                                        <button
                                                            onClick={() => {
                                                                posthog.capture('preferences_skipped_to_subject_selection');
                                                                setIsSkippedToSubjects(true);
                                                                setSelectedSchool(null);
                                                                setSelectedDomains([]);
                                                                setSelectedSubjects([]);
                                                                setSelectedSlots([]);
                                                                setSelectedFaculties([]);
                                                                setCurrentStep(stepKeys.indexOf('subject') + 1);
                                                            }}
                                                            className="w-full p-3 lg:p-4 mb-1 rounded-lg text-center font-bold text-white bg-gradient-to-r from-[#4C6EF5] to-[#3B5BDB] border border-[#3B5BDB]/20 hover:from-[#5C7CFA] hover:to-[#4C6EF5] shadow-lg shadow-[#3B5BDB]/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] cursor-pointer"
                                                        >
                                                            🔍 Skip & Search All Subjects
                                                        </button>
                                                    )}
                                                    {SCHOOLS.map(school => (
                                                        <button
                                                            key={school}
                                                            ref={(el) => { itemRefs.current[school] = el; }}
                                                            onClick={() => handleSchoolSelect(school, false)}
                                                            className={`${selectionButtonClass} cursor-pointer ${selectedSchool === school
                                                                ? selectionButtonSelectedClass
                                                                : selectionButtonUnselectedClass
                                                                }`}
                                                        >
                                                            {school}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Step: Domain Selection */}
                                            {stepKey === 'domain' && (
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                                                        Select one option
                                                    </p>
                                                    {domains.map(dept => (
                                                        <button
                                                            key={dept}
                                                            ref={(el) => { itemRefs.current[dept] = el; }}
                                                            onClick={() => handleDomainSelect(dept, false)}
                                                            className={`${selectionButtonClass} cursor-pointer ${selectedDomains.includes(dept)
                                                                ? selectionButtonSelectedClass
                                                                : selectionButtonUnselectedClass
                                                                }`}
                                                        >
                                                            {dept}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Step: Subject Selection */}
                                            {stepKey === 'subject' && (
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                                                        Select one option
                                                    </p>
                                                    <input
                                                        type="text"
                                                        placeholder="Search subjects by code or title..."
                                                        value={subjectSearchQuery}
                                                        onChange={(e) => setSubjectSearchQuery(e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 text-sm text-gray-800 bg-white"
                                                    />
                                                    {filteredSubjectsInStep.length > 0 ? filteredSubjectsInStep.map(subject => (
                                                        <button
                                                            key={subject}
                                                            ref={(el) => { itemRefs.current[subject] = el; }}
                                                            onClick={() => handleSubjectSelect(subject, false)}
                                                            className={`${selectionButtonClass} cursor-pointer ${selectedSubjects.includes(subject)
                                                                ? selectionButtonSelectedClass
                                                                : selectionButtonUnselectedClass
                                                                }`}
                                                        >
                                                            <div className="font-mono font-bold text-sm">
                                                                {subject.split(' - ')[0]}
                                                            </div>
                                                            <div className="text-xs text-gray-700 mt-1">
                                                                {subject.split(' - ').slice(1).join(' - ')}
                                                            </div>
                                                        </button>
                                                    )) : (
                                                        <div className="text-center text-gray-700 py-8">
                                                            {subjects.length > 0 ? 'No matching subjects found' : 'Please select a domain first'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Step: Slot Selection */}
                                            {stepKey === 'slot' && (
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                                                        Select one option
                                                    </p>
                                                    {slots.length > 0 ? slots.map(slot => {
                                                        return (
                                                            <button
                                                                key={slot}
                                                                ref={(el) => { itemRefs.current[slot] = el; }}
                                                                onClick={() => handleSlotSelect(slot, false)}
                                                                className={`${selectionButtonClass} ${selectedSlots.includes(slot)
                                                                    ? selectionButtonSelectedClass
                                                                    : selectionButtonUnselectedClass
                                                                    } flex items-center justify-between`}
                                                            >
                                                                <span>{slot}</span>
                                                            </button>
                                                        );
                                                    }) : (
                                                        <div className="text-center text-gray-700 py-8">
                                                            {isFacultyFirstMode ? 'Please select a faculty first' : 'Please select a subject first'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Step: Faculty Selection */}
                                            {stepKey === 'faculty' && (
                                                <div style={{ display: 'grid', gap: '10px' }}>
                                                    <p className={`text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1 ${selectionError ? 'mt-1' : ''}`}>
                                                        {isFacultyFirstMode ? 'Select one option' : 'Select one or more options'}
                                                    </p>
                                                    {faculties.length > 0 ? faculties.map((faculty, idx) => (
                                                        <button
                                                            key={idx}
                                                            ref={(el) => { itemRefs.current[faculty] = el; }}
                                                            onClick={() => handleFacultySelect(faculty)}
                                                            className={`${selectionButtonClass} ${selectedFaculties.includes(faculty)
                                                                ? selectionButtonSelectedClass
                                                                : selectionButtonUnselectedClass
                                                                }`}
                                                        >
                                                            {faculty}
                                                        </button>
                                                    )) : (
                                                        <div className="text-center text-gray-700 py-8">
                                                            {isFacultyFirstMode ? 'Please select a subject first' : 'Please select a slot first'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Step: Faculty Priority */}
                                            {stepKey === 'priority' && (
                                                <div className="flex flex-col h-full">
                                                    <p className="text-gray-800 font-medium mb-3">
                                                        Professors selected in Step {stepKeys.indexOf('faculty') + 1} are auto-added:
                                                    </p>

                                                    <div className="bg-white/50 rounded-lg p-4 shadow-sm border border-white/60">
                                                        <p className="text-sm font-bold text-gray-800 mb-3">Your Faculty Preferences:</p>
                                                        {savedFacultyPreferences.length > 0 ? (
                                                            <div style={{ display: 'grid', gap: '8px' }}>
                                                                {savedFacultyPreferences.map((f, idx) => {
                                                                    const name = typeof f === 'string' ? f : f.name;
                                                                    const type = typeof f === 'string' ? null : f.type;
                                                                    return (
                                                                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-bold text-gray-900">{name}</span>
                                                                                {type === 'theory' && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                                                                                        Theory
                                                                                    </span>
                                                                                )}
                                                                                {type === 'lab' && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                                                                                        Lab
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        <div className="flex gap-2 items-center">
                                                                            <button
                                                                                onClick={() => moveFacultyUp(idx)}
                                                                                disabled={idx === 0}
                                                                                className={`px-2 py-1 rounded border ${idx === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100"}`}
                                                                            >
                                                                                ↑
                                                                            </button>
                                                                            <button
                                                                                onClick={() => moveFacultyDown(idx)}
                                                                                disabled={idx === savedFacultyPreferences.length - 1}
                                                                                className={`px-2 py-1 rounded border ${idx === savedFacultyPreferences.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100"}`}
                                                                            >
                                                                                ↓
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = savedFacultyPreferences.filter((_, i) => i !== idx);
                                                                                    setSavedFacultyPreferences(updated);
                                                                                }}
                                                                                className="text-red-500 hover:text-red-700 font-bold ml-2 text-lg hover:bg-red-50 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">No faculty added yet</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}


                                        </div>

                                        {/* Navigation arrows within active panel */}
                                         <div className="flex justify-between mt-auto pt-3 shrink-0 px-1 pb-1">
                                             <button
                                                 onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                                                 disabled={currentStep === 1}
                                                 className={`w-10 h-10 flex items-center justify-center rounded-[10px] bg-white text-gray-900 shadow-sm transition-all duration-200 ${currentStep === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}`}
                                             >
                                                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                                             </button>
                                             
                                            {currentStep === stepKeys.length ? (
                                                 <div className="flex w-full gap-2 px-2">
                                                     <button
                                                         onClick={(e) => { e.stopPropagation(); handleAddAnotherProfessor(); }}
                                                         title={'Reset to Step 2 and select another subject'}
                                                         className="flex-1 px-3 py-2 rounded-lg font-bold text-sm bg-white text-blue-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                                                     >
                                                         + Add another
                                                     </button>
                                                     <button
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             posthog.capture('preferences_flow_completed');
                                                             router.push('/courses');
                                                         }}
                                                         title={'Save current preference and view all courses'}
                                                         className="flex-1 px-4 py-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                                                     >
                                                         Save & Continue →
                                                     </button>
                                                 </div>
                                             ) : (
                                                 <button
                                                     onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                                     disabled={!canProceed()}
                                                     className={`w-10 h-10 flex items-center justify-center rounded-[10px] bg-white text-gray-900 shadow-sm transition-all duration-200 cursor-pointer ${!canProceed() ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md'}`}
                                                 >
                                                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                                 </button>
                                             )}
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="h-full flex flex-col items-center justify-center px-1 lg:px-2 py-5 lg:py-6">
                                         <span className="text-[1.9rem] font-bold text-black mb-3">{stepNum}</span>
                                         <div
                                             className="text-base lg:text-[18px] font-bold tracking-wide flex-1 flex items-center justify-center whitespace-nowrap"
                                            style={{
                                                writingMode: 'vertical-rl',
                                                textOrientation: 'mixed',
                                                transform: 'rotate(180deg)'
                                            }}
                                         >
                                             {stepLabels[idx]}
                                         </div>
                                     </div>
                                 )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
        </div>

        {/* Bottom Navigation */}
        <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-[#F5E6D3] py-6 px-[clamp(16px,2vw,32px)] w-full flex justify-center"
            style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
        >
            <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 w-full">
                <div className="flex items-center justify-start gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        aria-label="Go to home page"
                        title="Home"
                        className="bg-white rounded-xl p-2.5 md:p-3 shadow-sm flex items-center justify-center min-w-12 min-h-12 md:min-w-14.5 md:min-h-14.5 hover:bg-gray-50 transition-colors shrink-0"
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
                    <div className="hidden md:flex bg-white rounded-xl p-3 shadow-sm items-center gap-3 w-auto overflow-hidden">
                            {session?.user?.image ? (
                                <Image src={session.user.image} alt="User avatar" width={36} height={36} className="w-9 h-9 rounded-lg border border-gray-100 shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-9 h-9 bg-gray-300 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0">
                                {session?.user?.name?.[0] || "?"}
                            </div>
                        )}
                        <span className="text-gray-800 text-sm font-bold truncate max-w-50 pr-2">
                            {session?.user?.name || "Guest"}
                        </span>
                    </div>
                </div>

                {/* CENTER - STEPS BOX */}
                <div className="bg-white rounded-xl p-2 shadow-sm flex justify-center items-center gap-1 sm:gap-2">
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
                                num === 1
                                    ? 'bg-[#A0C4FF] text-black px-4 min-w-9.5'
                                    : 'bg-[#A0C4FF]/40 text-black min-w-9.5'
                            }`}
                        >
                            {num === 1 ? '1. Preferences' : num}
                        </button>
                    ))}
                </div>

                {/* RIGHT - ACTION BOX */}
                <div className="hidden md:flex gap-2 lg:gap-3 justify-end shrink-0">
                    <button
                        onClick={() => {
                            if (currentStep > 1) {
                                handlePrevious();
                            } else {
                                deleteCookie('editingTimetableId');
                                router.push('/');
                            }
                        }}
                        className="px-8 py-3 bg-[#f1eacb] hover:bg-[#E8DDB8] border-2 border-[#A0C4FF] rounded-[10px] font-bold text-sm text-black transition-all duration-200"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-10 py-3 bg-[#A0C4FF] hover:bg-[#90B4EF] rounded-[10px] font-bold text-sm text-black transition-all duration-200 cursor-pointer"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>

        {isHelpOpen && (
            <ModeHelpDialog
                sections={FACULTY_FIRST_MODE_HELP}
                onClose={() => setIsHelpOpen(false)}
            />
        )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #ffffff;
                }

                @keyframes lucidFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes lucidPanelIn {
                    from { opacity: 0; transform: translateX(8px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                .animate-lucid-fade-up {
                    animation: lucidFadeUp 420ms ease-out;
                }

                .animate-lucid-fade-up-delayed {
                    animation: lucidFadeUp 560ms ease-out;
                }

                .animate-lucid-panel-in {
                    animation: lucidPanelIn 280ms ease-out;
                }
            `}</style>
        </>
    );
}
