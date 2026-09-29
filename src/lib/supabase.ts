import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseKey = supabasePublishableKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('کلیلەکانی پەیوەندی بە بنکەدراوەی شاخ لە ژینگەدا دانەنراون. VITE_SUPABASE_PUBLISHABLE_KEY یان VITE_SUPABASE_ANON_KEY پێویستە.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
