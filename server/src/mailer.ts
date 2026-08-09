import nodemailer from 'nodemailer';

const MOOD_EMOJI = ['', '😡', '🤨', '😐', '🙂', '😍'];

export interface FeedbackMail {
  mood: number;
  text: string;
  email: string;
}

/**
 * Sends a feedback email through the configured SMTP account (Hostinger).
 * Returns false when SMTP is not configured — callers store feedback in the
 * database regardless, so unsent mail never means lost feedback.
 */
export async function sendFeedbackMail(feedback: FeedbackMail): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user, pass }
  });

  const lines = [
    `Mood: ${MOOD_EMOJI[feedback.mood]} (${feedback.mood}/5)`,
    '',
    feedback.text || '(no text)',
    '',
    feedback.email ? `Reply to: ${feedback.email}` : '(no reply address left)',
    `Received: ${new Date().toISOString()}`
  ];

  try {
    await transporter.sendMail({
      from: `"TestMyHook feedback" <${user}>`,
      to: process.env.FEEDBACK_TO || 'feedback@testmyhook.dev',
      replyTo: feedback.email || undefined,
      subject: `Feedback ${MOOD_EMOJI[feedback.mood]} (${feedback.mood}/5) — testmyhook.dev`,
      text: lines.join('\n')
    });
    return true;
  } catch (err) {
    // Log the failure but never the feedback contents.
    console.error('feedback mail failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
