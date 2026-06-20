'use client';

import { useEffect, useRef } from 'react';
import { SessionProvider } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { TimetableProvider } from '@/lib/TimeTableContext';
import { PreferencesProvider } from '@/lib/PreferencesContext';
import AuthCacheSync from '@/components/AuthCacheSync';
import PlannerOnboardingTour from '@/components/PlannerOnboardingTour';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        ui_host: 'https://us.posthog.com',
        defaults: '2026-05-30',
        capture_pageview: true,
        autocapture: false,
        person_profiles: 'identified_only',
    });
}

function PostHogAuthSync() {
    const { data: session, status } = useSession();
    const lastIdentifiedEmail = useRef<string | null>(null);

    useEffect(() => {
        if (status !== 'authenticated') {
            lastIdentifiedEmail.current = null;
            return;
        }

        const email = session?.user?.email;
        if (!email || lastIdentifiedEmail.current === email) return;

        posthog.identify(email, {
            email,
            name: session.user?.name ?? undefined,
        });
        posthog.capture('login_succeeded', {
            provider: 'google',
        });
        lastIdentifiedEmail.current = email;
    }, [session, status]);

    return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <PostHogProvider client={posthog}>
                <PostHogAuthSync />
                <PreferencesProvider>
                    <TimetableProvider>
                        <AuthCacheSync />
                        {children}
                        <PlannerOnboardingTour />
                    </TimetableProvider>
                </PreferencesProvider>
            </PostHogProvider>
        </SessionProvider>
    );
}

