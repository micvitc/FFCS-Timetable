import { NextResponse } from 'next/server';

interface SurveyQuestion {
    question?: string;
    response?: string | number | boolean | null;
}

interface EmailPayload {
    from: string;
    to: string[];
    subject: string;
    text: string;
    reply_to?: string;
}

/**
 * POST /api/webhooks/survey
 * Handles incoming survey webhooks from PostHog, formats the responses,
 * and emails them to the admin with the responder's email as the Reply-To address.
 * 
 * Authentication: PostHog Webhook (Optional validation can be added based on headers)
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Verify we have a survey response event
        // PostHog sends the event name as "event"
        const event = body.event;
        const properties = body.properties || {};

        // Also check if this is a test webhook request from PostHog UI
        const isTest = body.hook?.id && !event;
        const isValidEvent = event === 'survey sent' || event === 'feedback_submitted';

        if (!isValidEvent && !isTest) {
            return NextResponse.json({ 
                success: true, 
                message: `Ignored event: ${event || 'unknown'}` 
            }, { status: 200 });
        }

        // 2. Extract configuration
        const apiKey = process.env.RESEND_API_KEY;
        const targetEmail = process.env.CONTACT_EMAIL;

        if (!apiKey || !targetEmail) {
            console.error('Webhook Error: RESEND_API_KEY or CONTACT_EMAIL environment variable is missing.');
            return NextResponse.json({ 
                error: 'Email configuration is incomplete on the server.' 
            }, { status: 500 });
        }

        // 3. Handle test webhook ping
        if (isTest) {
            const testRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: 'Feedback Bot <onboarding@resend.dev>',
                    to: [targetEmail],
                    subject: 'PostHog Webhook Test Connection',
                    text: 'Congratulations! Your PostHog Webhook integration with FFCS Timetable is working correctly.',
                }),
            });

            if (!testRes.ok) {
                const errText = await testRes.text();
                throw new Error(`Resend API failed: ${errText}`);
            }

            return NextResponse.json({ success: true, message: 'Test email sent successfully' });
        }

        // 4. Parse user identifier (email / distinct_id)
        // Check standard places: distinct_id, properties.$email, or properties.email
        let userEmail = body.distinct_id || 'anonymous';
        if (properties['$email']) {
            userEmail = properties['$email'];
        } else if (properties['email']) {
            userEmail = properties['email'];
        }

        // 5. Parse survey details
        const surveyName = properties['$survey_name'] || (event === 'feedback_submitted' ? 'User Rating Feedback' : 'General Survey');
        const surveyId = properties['$survey_id'] || 'unknown';
        const surveyQuestions = (properties['$survey_questions'] || []) as SurveyQuestion[];

        let feedbackContent = `Feedback Source: ${surveyName}\n`;
        feedbackContent += `Event Type: ${event || 'Test Webhook'}\n`;
        if (surveyId !== 'unknown') {
            feedbackContent += `Survey ID: ${surveyId}\n`;
        }
        feedbackContent += `Submitted By: ${userEmail}\n`;
        feedbackContent += `Timestamp: ${new Date().toLocaleString()}\n\n`;
        feedbackContent += `--- FEEDBACK DETAILS ---\n\n`;

        if (event === 'feedback_submitted') {
            const rating = properties['rating'] !== undefined ? properties['rating'] : 'N/A';
            const comment = properties['comment'] || 'No comment';
            const source = properties['source'] || 'unknown';
            feedbackContent += `Rating: ${rating}/5\n`;
            feedbackContent += `Comment: ${comment}\n`;
            feedbackContent += `Source: ${source}\n`;
        } else if (Array.isArray(surveyQuestions) && surveyQuestions.length > 0) {
            surveyQuestions.forEach((q: SurveyQuestion) => {
                const questionText = q.question || 'Question';
                const answerText = q.response !== undefined && q.response !== null ? String(q.response) : 'No response';
                feedbackContent += `Q: ${questionText}\nA: ${answerText}\n\n`;
            });
        } else {
            // Fallback: search properties for any key starting with '$survey_response_'
            let foundAnswers = false;
            Object.keys(properties).forEach((key) => {
                if (key.startsWith('$survey_response_')) {
                    const cleanKey = key.replace('$survey_response_', '');
                    feedbackContent += `Q/ID: ${cleanKey}\nA: ${properties[key]}\n\n`;
                    foundAnswers = true;
                }
            });

            if (!foundAnswers) {
                feedbackContent += `No detailed responses extracted from properties.\nRaw properties: ${JSON.stringify(properties, null, 2)}\n`;
            }
        }

        // 6. Send the email using Resend REST API
        const emailPayload: EmailPayload = {
            from: 'Feedback Bot <onboarding@resend.dev>',
            to: [targetEmail],
            subject: `Feedback: ${surveyName} - from ${userEmail}`,
            text: feedbackContent,
        };

        // Only set replyTo if the user email is a valid-looking email address
        if (userEmail.includes('@')) {
            emailPayload.reply_to = userEmail;
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(emailPayload),
        });

        if (!resendResponse.ok) {
            const errText = await resendResponse.text();
            throw new Error(`Resend API response status ${resendResponse.status}: ${errText}`);
        }

        const resData = await resendResponse.json();

        return NextResponse.json({ 
            success: true, 
            message: 'Survey response forwarded successfully',
            emailId: resData.id
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Survey Webhook Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: errorMsg
        }, { status: 500 });
    }
}
