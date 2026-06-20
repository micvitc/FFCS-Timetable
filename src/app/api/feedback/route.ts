import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/models/feedback';

export async function POST(req: Request) {
    try {
        await dbConnect();

        const body = await req.json();
        const { feedback, userName, email } = body;

        if (!feedback) {
            return NextResponse.json({ message: "Feedback is required" }, { status: 400 });
        }

        const newFeedback = new Feedback({
            feedback,
            userName: userName || "Anonymous",
            email: email || "No Email",
        });

        await newFeedback.save();

        // Send email via Resend if API key and recipient email are configured
        const resendApiKey = process.env.RESEND_API_KEY;
        const contactEmail = process.env.CONTACT_EMAIL;

        if (resendApiKey && contactEmail) {
            try {
                const emailResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                        from: 'FFCS Feedback <onboarding@resend.dev>',
                        to: contactEmail,
                        subject: `New FFCS Timetable Feedback`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #ffffff;">
                                <h2 style="color: #111827; border-bottom: 2px solid #A0C4FF; padding-bottom: 10px; margin-top: 0;">New Feedback Received</h2>
                                <p style="font-size: 14px; color: #4b5563;">A user has submitted feedback for the FFCS Timetable Planner.</p>
                                
                                <div style="background-color: #f9fafb; padding: 16px; border: 1px solid #f3f4f6; border-radius: 12px; margin: 20px 0;">
                                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>User:</strong> ${userName || "Anonymous"}</p>
                                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;"><strong>Email:</strong> ${email || "No Email"}</p>
                                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151; font-weight: bold;">Message:</p>
                                    <p style="white-space: pre-wrap; font-style: italic; color: #111827; margin: 0; padding-left: 12px; border-left: 3px solid #A0C4FF; font-size: 14px; line-height: 1.5;">${feedback}</p>
                                </div>
                                
                                <p style="font-size: 11px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 12px; text-align: center;">Sent automatically by the FFCS Feedback Server.</p>
                            </div>
                        `,
                    }),
                });

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text();
                    console.error("Resend API failed:", errorText);
                }
            } catch (err) {
                console.error("Failed to send email via Resend:", err);
            }
        }

        return NextResponse.json({ message: "Feedback submitted successfully" }, { status: 201 });
    } catch (error) {
        console.error("Feedback error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
