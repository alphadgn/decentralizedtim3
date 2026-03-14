
-- Enable realtime for security_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_alerts;

-- Add expires_at to api_keys for expiry tracking
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT NULL;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
