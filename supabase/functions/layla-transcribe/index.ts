// Authenticated voice transcription for Layla. Requires GROQ_API_KEY in Supabase secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const key = Deno.env.get('GROQ_API_KEY') || Deno.env.get('LLM_API_KEY');
  if (!key) return reply({ error: 'Missing GROQ_API_KEY or LLM_API_KEY secret' }, 503);
  const token = req.headers.get('Authorization') || '';
  if (!token.startsWith('Bearer ')) return reply({ error: 'Login required' }, 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } } });
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return reply({ error: 'Login required' }, 401);
  let form: FormData;
  try { form = await req.formData(); } catch { return reply({ error: 'Invalid audio payload' }, 400); }
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !file.type.startsWith('audio/')) return reply({ error: 'Audio must be smaller than 10 MB' }, 400);
  const upstream = new FormData();
  upstream.append('file', file, file.name || 'recording.webm');
  upstream.append('model', 'whisper-large-v3-turbo');
  upstream.append('language', 'ar');
  const signal = AbortSignal.timeout(30000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: upstream, signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { console.error('transcribe upstream', response.status); return reply({ error: 'Transcription provider unavailable (' + response.status + ')' }, 502); }
    return reply({ text: String(data.text || '').slice(0, 4000) });
  } catch (e) { console.error('transcription failed', e); return reply({ error: 'Audio transcription timed out or failed' }, 504); }
});
