-- Add unique constraint for user_id + numero combination on inscritos table
ALTER TABLE public.inscritos 
ADD CONSTRAINT inscritos_user_numero_unique UNIQUE (user_id, numero);