import posthog from 'posthog-js';

export const FEATURE_FLAGS = {
  facultyFirstPreferenceFlow: 'faculty_first_preference_flow',
  plannerOnboardingTour: 'planner_onboarding_tour',
  useNewCourseParser: 'use_new_course_parser',
  schoolSelectionStep: 'school_selection_step',
  directJumpToCourses: 'direct_jump_to_courses',
  courseUpdateAlert: 'course_update_alert',
  sessionBasedSlotPairing: 'session_based_slot_pairing',
  simplifiedFlow: 'simplified_flow',
} as const;

export type FeatureFlagName = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

export function isSessionBasedSlotPairingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!posthog.isFeatureEnabled(FEATURE_FLAGS.sessionBasedSlotPairing);
  } catch {
    return false;
  }
}

export function isSimplifiedFlowEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!posthog.isFeatureEnabled(FEATURE_FLAGS.simplifiedFlow);
  } catch {
    return false;
  }
}

