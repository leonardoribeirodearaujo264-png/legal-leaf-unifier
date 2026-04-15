
CREATE TABLE public.advbox_settings_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.advbox_settings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated approved users can view settings cache"
ON public.advbox_settings_cache
FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

CREATE POLICY "Service role can manage settings cache"
ON public.advbox_settings_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
