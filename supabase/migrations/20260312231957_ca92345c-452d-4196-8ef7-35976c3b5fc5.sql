-- Fix: Restrict profiles SELECT to authenticated users only
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Fix: Restrict profiles INSERT to authenticated users only
DROP POLICY "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix: Restrict profiles UPDATE to authenticated users only
DROP POLICY "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);