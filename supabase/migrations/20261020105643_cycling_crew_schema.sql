-- Drop existing dependent tables first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.participations CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.session_participants CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;

-- Ensure profiles exists and convert role column to TEXT
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely convert role to TEXT if it was an enum before
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT USING lower(role::text);
EXCEPTION
  WHEN undefined_column THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'pending';
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'pending';

-- 2. Trigger for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  initial_role TEXT;
BEGIN
  -- First user becomes admin, subsequent users become pending
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    initial_role := 'admin';
  ELSE
    initial_role := 'pending';
  END IF;

  INSERT INTO public.profiles (id, email, name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    initial_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(public.profiles.name, EXCLUDED.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Posts Table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('notice', 'riding', 'general')),
  riding_date TIMESTAMPTZ,
  location TEXT,
  distance_km NUMERIC,
  target_pace TEXT, -- e.g. "평속 28-30 km/h"
  max_participants INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Participations Table
CREATE TABLE public.participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 5. Admin role update RPC function
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can update member roles.';
  END IF;

  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Posts Policies
DROP POLICY IF EXISTS "Read posts policy" ON public.posts;
CREATE POLICY "Read posts policy" ON public.posts
  FOR SELECT USING (
    category = 'notice' OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('member', 'admin'))
  );

DROP POLICY IF EXISTS "Insert posts policy" ON public.posts;
CREATE POLICY "Insert posts policy" ON public.posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('member', 'admin'))
  );

DROP POLICY IF EXISTS "Update/Delete own posts or Admin" ON public.posts;
CREATE POLICY "Update/Delete own posts or Admin" ON public.posts
  FOR ALL USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Participations Policies
DROP POLICY IF EXISTS "View participations" ON public.participations;
CREATE POLICY "View participations" ON public.participations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('member', 'admin'))
  );

DROP POLICY IF EXISTS "Insert participation" ON public.participations;
CREATE POLICY "Insert participation" ON public.participations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('member', 'admin'))
  );

DROP POLICY IF EXISTS "Delete own participation" ON public.participations;
CREATE POLICY "Delete own participation" ON public.participations
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
