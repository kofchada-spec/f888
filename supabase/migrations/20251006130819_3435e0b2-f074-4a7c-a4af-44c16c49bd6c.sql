-- Add validation constraints for profiles table
-- These constraints ensure data integrity at the database level

-- Add constraint for height (must be between 1.0m and 2.5m)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_height_range 
CHECK (height_m IS NULL OR (height_m >= 1.0 AND height_m <= 2.5));

-- Add constraint for weight (must be between 30kg and 250kg)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_weight_range 
CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 250));

-- Add constraint for age (must be at least 13 years old)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_age_minimum 
CHECK (age_years IS NULL OR age_years >= 13);

-- Add constraint for birth date (must be reasonable - not in future, not too far in past)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_birth_date_range 
CHECK (birth_date IS NULL OR (birth_date <= CURRENT_DATE AND birth_date >= '1900-01-01'));

-- Add unique constraint on user_id in subscribers table to support user_id-based upserts
ALTER TABLE public.subscribers 
ADD CONSTRAINT subscribers_user_id_key 
UNIQUE (user_id);