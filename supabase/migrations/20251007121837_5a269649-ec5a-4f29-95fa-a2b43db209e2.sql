-- Update trial period from 14 days to 3 days
ALTER TABLE public.subscribers 
ALTER COLUMN trial_end SET DEFAULT (now() + '3 days'::interval);