-- Add onboarding and profile completion tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_complete boolean DEFAULT false;

-- Update existing profiles to mark them as complete if they have basic data
UPDATE public.profiles 
SET onboarding_complete = true,
    profile_complete = true
WHERE first_name IS NOT NULL 
   OR last_name IS NOT NULL 
   OR height_m IS NOT NULL 
   OR weight_kg IS NOT NULL;