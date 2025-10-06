-- Fix critical security issue: Remove email-based access to subscribers table
-- Only user_id should be used for access control

-- Drop existing policies that use email matching
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscribers;

-- Recreate policies using only user_id for access control
CREATE POLICY "select_own_subscription" ON public.subscribers
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription" ON public.subscribers
  FOR UPDATE 
  USING (user_id = auth.uid());

-- Add explicit DELETE policy for profiles table for clarity
CREATE POLICY "Profiles cannot be deleted by users" ON public.profiles
  FOR DELETE
  USING (false);