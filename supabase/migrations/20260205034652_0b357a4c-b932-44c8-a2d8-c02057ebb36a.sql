-- Add character_type field to characters table
ALTER TABLE public.characters 
ADD COLUMN character_type text NOT NULL DEFAULT 'character';

-- Add check constraint to ensure valid values
ALTER TABLE public.characters 
ADD CONSTRAINT characters_character_type_check 
CHECK (character_type IN ('character', 'environment'));