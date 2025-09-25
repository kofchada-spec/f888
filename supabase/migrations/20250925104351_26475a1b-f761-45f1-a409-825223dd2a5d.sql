-- Fix overly permissive RLS policies on subscribers table
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create more secure policies
-- Users can only update their own subscription records
CREATE POLICY "Users can update their own subscription" 
ON public.subscribers 
FOR UPDATE 
USING (user_id = auth.uid() OR email = auth.email());

-- Only allow inserts through server functions (edge functions)
-- This prevents direct client-side inserts
CREATE POLICY "Only server can insert subscriptions" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (false);

-- Add a policy to allow server functions to insert (they run with elevated privileges)
-- We'll handle subscription creation through edge functions only
CREATE POLICY "Service role can insert subscriptions" 
ON public.subscribers 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Ensure users can't delete subscription records
CREATE POLICY "No deletes allowed" 
ON public.subscribers 
FOR DELETE 
USING (false);