-- Add image_approved column for manual review process
ALTER TABLE public.scenes ADD COLUMN image_approved boolean NOT NULL DEFAULT false;