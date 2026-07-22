/**
 * send-support-email
 *
 * Delivers a Help & Support message (from either the merchant or the consumer
 * app) to the support inbox as a real email.
 *
 * Key behaviour: the SENDER is our verified Resend domain (required — Resend will
 * not send "from" an arbitrary user address), but `reply_to` is set to the user's
 * own email. So hitting Reply in the support inbox replies straight to the user.
 *
 * Env:
 *   RESEND_API_KEY      — Resend.com API key for transactional email
 *   RESEND_FROM_EMAIL   — Verified sender (e.g. "DealPro <noreply@dealpro.in>")
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPPORT_INBOX = 'support@vedicjaalam.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!jwt) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    console.warn('[send-support-email] JWT auth failed:', error?.message);
    return null;
  }
  return user;
}

function buildHtml(args: {
  name: string;
  email: string;
  subject: string;
  message: string;
  appLabel: string;
  userId: string;
}): string {
  // Preserve the user's line breaks in the email body.
  const messageHtml = escapeHtml(args.message).replace(/\r?\n/g, '<br>');
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h2 style="margin:0 0 4px;font-size:18px">New ${escapeHtml(args.appLabel)} support message</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b">Reply to this email to respond directly to the user.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#64748b;width:96px">From</td><td style="padding:6px 0"><strong>${escapeHtml(args.name || '—')}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(args.email)}">${escapeHtml(args.email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">App</td><td style="padding:6px 0">${escapeHtml(args.appLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Subject</td><td style="padding:6px 0">${escapeHtml(args.subject || '—')}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">User ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px;color:#475569">${escapeHtml(args.userId || '—')}</td></tr>
    </table>
    <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:1.6;white-space:pre-line">${messageHtml}</div>
  </div>`;
}

type AckCopy = {
  subject: string;
  greeting: string;
  thanks: string;
  received: string; // contains {window}
  window: string;
  meantimeHeading: string;
  meantimeBody: string;
  patience: string;
  regards: string;
  team: string;
};

// The support auto-response, in every language the apps ship in. "Vedic Jaalam"
// stays in Latin script everywhere so the brand reads consistently.
const ACK_COPY: Record<string, AckCopy> = {
  en: {
    subject: 'Thank you for contacting Vedic Jaalam',
    greeting: 'Hi there,',
    thanks: 'Thank you for contacting Vedic Jaalam!',
    received: 'We have successfully received your email, and our team is currently reviewing your inquiry. One of our representatives will follow up with you within {window}.',
    window: '24 to 48 hours (Monday through Friday)',
    meantimeHeading: 'What you can do in the meantime:',
    meantimeBody: 'If you have additional details, context, or screenshots to add to your request, simply reply directly to this email.',
    patience: 'We appreciate your patience and look forward to assisting you soon!',
    regards: 'Warm regards,',
    team: 'The Vedic Jaalam Support Team',
  },
  hi: {
    subject: 'Vedic Jaalam से संपर्क करने के लिए धन्यवाद',
    greeting: 'नमस्ते,',
    thanks: 'Vedic Jaalam से संपर्क करने के लिए धन्यवाद!',
    received: 'हमें आपका ईमेल सफलतापूर्वक मिल गया है और हमारी टीम आपके अनुरोध की समीक्षा कर रही है। हमारा एक प्रतिनिधि {window} के भीतर आपसे संपर्क करेगा।',
    window: '24 से 48 घंटों (सोमवार से शुक्रवार)',
    meantimeHeading: 'इस बीच आप क्या कर सकते हैं:',
    meantimeBody: 'यदि आपके पास अपने अनुरोध में जोड़ने के लिए अतिरिक्त जानकारी, संदर्भ या स्क्रीनशॉट हैं, तो बस इसी ईमेल का उत्तर दें।',
    patience: 'आपके धैर्य के लिए धन्यवाद, हम जल्द ही आपकी सहायता करने के लिए तत्पर हैं!',
    regards: 'सादर,',
    team: 'Vedic Jaalam सहायता टीम',
  },
  kn: {
    subject: 'Vedic Jaalam ಅನ್ನು ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು',
    greeting: 'ನಮಸ್ಕಾರ,',
    thanks: 'Vedic Jaalam ಅನ್ನು ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು!',
    received: 'ನಿಮ್ಮ ಇಮೇಲ್ ನಮಗೆ ಯಶಸ್ವಿಯಾಗಿ ತಲುಪಿದೆ ಮತ್ತು ನಮ್ಮ ತಂಡ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದೆ. ನಮ್ಮ ಪ್ರತಿನಿಧಿಯೊಬ್ಬರು {window} ಒಳಗೆ ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸುತ್ತಾರೆ.',
    window: '24 ರಿಂದ 48 ಗಂಟೆಗಳ (ಸೋಮವಾರದಿಂದ ಶುಕ್ರವಾರ)',
    meantimeHeading: 'ಈ ಮಧ್ಯೆ ನೀವು ಏನು ಮಾಡಬಹುದು:',
    meantimeBody: 'ನಿಮ್ಮ ವಿನಂತಿಗೆ ಸೇರಿಸಲು ಹೆಚ್ಚುವರಿ ವಿವರಗಳು, ಮಾಹಿತಿ ಅಥವಾ ಸ್ಕ್ರೀನ್‌ಶಾಟ್‌ಗಳಿದ್ದರೆ, ಈ ಇಮೇಲ್‌ಗೆ ನೇರವಾಗಿ ಉತ್ತರಿಸಿ.',
    patience: 'ನಿಮ್ಮ ತಾಳ್ಮೆಗೆ ಧನ್ಯವಾದಗಳು, ಶೀಘ್ರದಲ್ಲೇ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ನಾವು ಎದುರು ನೋಡುತ್ತಿದ್ದೇವೆ!',
    regards: 'ವಂದನೆಗಳು,',
    team: 'Vedic Jaalam ಬೆಂಬಲ ತಂಡ',
  },
  ta: {
    subject: 'Vedic Jaalam ஐ தொடர்பு கொண்டதற்கு நன்றி',
    greeting: 'வணக்கம்,',
    thanks: 'Vedic Jaalam ஐ தொடர்பு கொண்டதற்கு நன்றி!',
    received: 'உங்கள் மின்னஞ்சலை நாங்கள் வெற்றிகரமாகப் பெற்றுள்ளோம், எங்கள் குழு உங்கள் கோரிக்கையை பரிசீலித்து வருகிறது. எங்கள் பிரதிநிதி ஒருவர் {window} உங்களைத் தொடர்பு கொள்வார்.',
    window: '24 முதல் 48 மணி நேரத்திற்குள் (திங்கள் முதல் வெள்ளி வரை)',
    meantimeHeading: 'இதற்கிடையில் நீங்கள் என்ன செய்யலாம்:',
    meantimeBody: 'உங்கள் கோரிக்கையில் சேர்க்க கூடுதல் விவரங்கள், தகவல்கள் அல்லது ஸ்கிரீன்ஷாட்கள் இருந்தால், இந்த மின்னஞ்சலுக்கு நேரடியாக பதிலளிக்கவும்.',
    patience: 'உங்கள் பொறுமைக்கு நன்றி, விரைவில் உங்களுக்கு உதவ ஆவலுடன் காத்திருக்கிறோம்!',
    regards: 'அன்புடன்,',
    team: 'Vedic Jaalam ஆதரவு குழு',
  },
  te: {
    subject: 'Vedic Jaalam ను సంప్రదించినందుకు ధన్యవాదాలు',
    greeting: 'నమస్కారం,',
    thanks: 'Vedic Jaalam ను సంప్రదించినందుకు ధన్యవాదాలు!',
    received: 'మీ ఇమెయిల్ మాకు విజయవంతంగా అందింది, మా బృందం మీ అభ్యర్థనను సమీక్షిస్తోంది. మా ప్రతినిధి ఒకరు {window} లోపు మిమ్మల్ని సంప్రదిస్తారు.',
    window: '24 నుండి 48 గంటల (సోమవారం నుండి శుక్రవారం)',
    meantimeHeading: 'ఈలోగా మీరు ఏమి చేయవచ్చు:',
    meantimeBody: 'మీ అభ్యర్థనకు జోడించడానికి అదనపు వివరాలు, సమాచారం లేదా స్క్రీన్‌షాట్‌లు ఉంటే, ఈ ఇమెయిల్‌కు నేరుగా ప్రత్యుత్తరం ఇవ్వండి.',
    patience: 'మీ ఓర్పుకు ధన్యవాదాలు, త్వరలో మీకు సహాయం చేయడానికి మేము ఎదురుచూస్తున్నాము!',
    regards: 'భవదీయులు,',
    team: 'Vedic Jaalam సపోర్ట్ బృందం',
  },
  ml: {
    subject: 'Vedic Jaalam-നെ ബന്ധപ്പെട്ടതിന് നന്ദി',
    greeting: 'നമസ്കാരം,',
    thanks: 'Vedic Jaalam-നെ ബന്ധപ്പെട്ടതിന് നന്ദി!',
    received: 'നിങ്ങളുടെ ഇമെയിൽ ഞങ്ങൾക്ക് ലഭിച്ചു, ഞങ്ങളുടെ ടീം നിങ്ങളുടെ അഭ്യർത്ഥന പരിശോധിച്ചുവരികയാണ്. ഞങ്ങളുടെ ഒരു പ്രതിനിധി {window} നിങ്ങളെ ബന്ധപ്പെടും.',
    window: '24 മുതൽ 48 മണിക്കൂറിനുള്ളിൽ (തിങ്കൾ മുതൽ വെള്ളി വരെ)',
    meantimeHeading: 'അതിനിടയിൽ നിങ്ങൾക്ക് ചെയ്യാവുന്നത്:',
    meantimeBody: 'നിങ്ങളുടെ അഭ്യർത്ഥനയിൽ ചേർക്കാൻ കൂടുതൽ വിവരങ്ങളോ സ്ക്രീൻഷോട്ടുകളോ ഉണ്ടെങ്കിൽ, ഈ ഇമെയിലിന് നേരിട്ട് മറുപടി നൽകുക.',
    patience: 'നിങ്ങളുടെ ക്ഷമയ്ക്ക് നന്ദി, ഉടൻ നിങ്ങളെ സഹായിക്കാൻ ഞങ്ങൾ കാത്തിരിക്കുന്നു!',
    regards: 'സ്നേഹപൂർവ്വം,',
    team: 'Vedic Jaalam പിന്തുണ ടീം',
  },
  bn: {
    subject: 'Vedic Jaalam-এর সাথে যোগাযোগ করার জন্য ধন্যবাদ',
    greeting: 'নমস্কার,',
    thanks: 'Vedic Jaalam-এর সাথে যোগাযোগ করার জন্য ধন্যবাদ!',
    received: 'আমরা আপনার ইমেল সফলভাবে পেয়েছি এবং আমাদের টিম আপনার অনুরোধটি পর্যালোচনা করছে। আমাদের একজন প্রতিনিধি {window} মধ্যে আপনার সাথে যোগাযোগ করবেন।',
    window: '24 থেকে 48 ঘণ্টার (সোমবার থেকে শুক্রবার)',
    meantimeHeading: 'এর মধ্যে আপনি যা করতে পারেন:',
    meantimeBody: 'আপনার অনুরোধে যোগ করার জন্য অতিরিক্ত তথ্য, প্রসঙ্গ বা স্ক্রিনশট থাকলে, সরাসরি এই ইমেলের উত্তর দিন।',
    patience: 'আপনার ধৈর্যের জন্য ধন্যবাদ, শীঘ্রই আপনাকে সহায়তা করার অপেক্ষায় রইলাম!',
    regards: 'শুভেচ্ছান্তে,',
    team: 'Vedic Jaalam সাপোর্ট টিম',
  },
  mr: {
    subject: 'Vedic Jaalam शी संपर्क साधल्याबद्दल धन्यवाद',
    greeting: 'नमस्कार,',
    thanks: 'Vedic Jaalam शी संपर्क साधल्याबद्दल धन्यवाद!',
    received: 'आम्हाला तुमचा ईमेल यशस्वीरित्या मिळाला आहे आणि आमची टीम तुमच्या विनंतीचा आढावा घेत आहे. आमचा एक प्रतिनिधी {window} तुमच्याशी संपर्क साधेल.',
    window: '24 ते 48 तासांत (सोमवार ते शुक्रवार)',
    meantimeHeading: 'दरम्यान तुम्ही काय करू शकता:',
    meantimeBody: 'तुमच्या विनंतीत जोडण्यासाठी अतिरिक्त तपशील, माहिती किंवा स्क्रीनशॉट असल्यास, थेट या ईमेलला उत्तर द्या.',
    patience: 'तुमच्या संयमाबद्दल धन्यवाद, लवकरच तुम्हाला मदत करण्यास आम्ही उत्सुक आहोत!',
    regards: 'सादर,',
    team: 'Vedic Jaalam सपोर्ट टीम',
  },
  gu: {
    subject: 'Vedic Jaalam નો સંપર્ક કરવા બદલ આભાર',
    greeting: 'નમસ્તે,',
    thanks: 'Vedic Jaalam નો સંપર્ક કરવા બદલ આભાર!',
    received: 'અમને તમારો ઈમેલ સફળતાપૂર્વક મળ્યો છે અને અમારી ટીમ તમારી વિનંતીની સમીક્ષા કરી રહી છે. અમારો એક પ્રતિનિધિ {window} માં તમારો સંપર્ક કરશે.',
    window: '24 થી 48 કલાક (સોમવારથી શુક્રવાર)',
    meantimeHeading: 'તે દરમિયાન તમે શું કરી શકો:',
    meantimeBody: 'તમારી વિનંતીમાં ઉમેરવા માટે વધારાની વિગતો, માહિતી અથવા સ્ક્રીનશોટ હોય, તો સીધા આ ઈમેલનો જવાબ આપો.',
    patience: 'તમારી ધીરજ બદલ આભાર, ટૂંક સમયમાં તમને મદદ કરવા અમે આતુર છીએ!',
    regards: 'સાદર,',
    team: 'Vedic Jaalam સપોર્ટ ટીમ',
  },
};

function ackCopyFor(locale?: unknown): AckCopy {
  const key = String(locale ?? 'en').toLowerCase().split('-')[0];
  return ACK_COPY[key] ?? ACK_COPY.en;
}

async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string; status?: number; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const data = await res.json().catch(() => ({}));
  return { ok: true, id: (data as any)?.id };
}

// The support auto-response, sent BY US to the submitter (a mailbox
// auto-responder can never reach them — see the call site).
function buildAckHtml(c: AckCopy): string {
  const received = escapeHtml(c.received).replace(
    '{window}',
    `<strong>${escapeHtml(c.window)}</strong>`,
  );
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;font-size:14px;line-height:1.7">
    <p style="margin:0 0 16px">${escapeHtml(c.greeting)}</p>
    <p style="margin:0 0 16px">${escapeHtml(c.thanks)}</p>
    <p style="margin:0 0 16px">${received}</p>
    <p style="margin:0 0 8px"><strong>${escapeHtml(c.meantimeHeading)}</strong></p>
    <p style="margin:0 0 16px">${escapeHtml(c.meantimeBody)}</p>
    <p style="margin:0 0 16px">${escapeHtml(c.patience)}</p>
    <p style="margin:0 0 4px">${escapeHtml(c.regards)}</p>
    <p style="margin:0 0 4px"><strong>${escapeHtml(c.team)}</strong></p>
    <p style="margin:0">
      <a href="mailto:${SUPPORT_INBOX}" style="color:#2563eb;text-decoration:none">${SUPPORT_INBOX}</a>
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Best-effort identity: used only to stamp the ticket. A failed lookup must
    // not block a user who is genuinely trying to reach support.
    const user = await authenticateRequest(req);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const subject = String(body?.subject ?? '').trim();
    const message = String(body?.message ?? '').trim();
    const appLabel = body?.app === 'merchant' ? 'Merchant app' : 'Consumer app';

    if (!EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: 'A valid email address is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!message) {
      return new Response(JSON.stringify({ error: 'A message is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'DealPro <noreply@dealpro.in>';
    if (!apiKey) {
      console.error('[send-support-email] RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email is not configured. Please try again later.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      });
    }

    const ticket = await sendViaResend(apiKey, {
      from,
      to: [SUPPORT_INBOX],
      // Replying in the support inbox goes straight back to the user.
      reply_to: [email],
      subject: `[${appLabel}] ${subject || 'Support request'} — ${name || email}`,
      html: buildHtml({ name, email, subject, message, appLabel, userId: user?.id ?? '' }),
    });

    if (!ticket.ok) {
      // Log AND return the provider's reason. Without it a 502 is undiagnosable:
      // the usual causes (unverified `from` domain, Resend test-mode recipient
      // restrictions, bad key) all look identical from the client.
      console.error('[send-support-email] Resend failed:', ticket.status, 'from:', from, 'to:', SUPPORT_INBOX, ticket.error);
      return new Response(JSON.stringify({
        error: 'Could not send your message. Please try again.',
        details: { provider_status: ticket.status, provider_error: ticket.error, from, to: SUPPORT_INBOX },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }
    console.log('[send-support-email] Sent to support, resend id:', ticket.id);

    // Acknowledgement to the USER. A mailbox auto-responder cannot do this: the
    // ticket arrives From our own support address (not the user's), and auto-
    // responders reply to the From/Return-Path and ignore Reply-To (RFC 3834) —
    // so they self-reply or suppress it as a loop. Sending it ourselves is the
    // only reliable way the submitter hears back. Best-effort: support already
    // has the ticket, so a failed ack must never fail the request.
    const ackCopy = ackCopyFor(body?.locale);
    const ack = await sendViaResend(apiKey, {
      from,
      to: [email],
      reply_to: [SUPPORT_INBOX],
      subject: ackCopy.subject,
      html: buildAckHtml(ackCopy),
    });
    if (!ack.ok) {
      console.warn('[send-support-email] Acknowledgement to user failed:', ack.status, ack.error);
    }

    return new Response(JSON.stringify({ success: true, id: ticket.id, acknowledged: ack.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[send-support-email] Error:', error?.message);
    return new Response(JSON.stringify({ error: 'Could not send your message. Please try again.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
