-- Update existing user's trial period to 3 days
UPDATE public.subscribers 
SET trial_end = now() + interval '3 days'
WHERE email = 'c.koffi@icloud.com';