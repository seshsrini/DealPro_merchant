-- Pincode directory: one row per (pincode + area). Run on DEV and PROD (safe to re-run).
-- Needs pincode_directory_search.sql first (for dir_norm).
--
-- The same area name can exist under different pincodes (e.g. "Vignan Nagar"
-- in 560037 and 560075), so uniqueness is the PAIR. Names are compared with
-- dir_norm(), so spelling variants ("Indiranagar" / "Indira Nagar") of an area
-- already in that pincode count as the same area.
--
-- A unique index isn't possible yet: the India Post import already has ~850
-- repeated rows. This trigger blocks every NEW repeat — from the admin page,
-- merchant store add/edit, merchant signup or any script — and takes a
-- per-pincode lock so two saves at the same moment can't both get in.
-- It raises SQLSTATE 23505 (unique_violation), like a real unique index.

CREATE OR REPLACE FUNCTION public.pincode_directory_block_dup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hit text;
BEGIN
  NEW.pincode  := trim(NEW.pincode);
  NEW.locality := regexp_replace(trim(coalesce(NEW.locality, '')), '\s+', ' ', 'g');

  IF TG_OP = 'UPDATE' AND NEW.pincode = OLD.pincode AND public.dir_norm(NEW.locality) = public.dir_norm(OLD.locality) THEN
    RETURN NEW;  -- pincode/area unchanged (e.g. only city or state edited)
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pincode_directory:' || NEW.pincode));

  SELECT d.locality INTO hit
  FROM public.pincode_directory d
  WHERE d.pincode = NEW.pincode
    AND public.dir_norm(d.locality) = public.dir_norm(NEW.locality)
    AND d.id IS DISTINCT FROM NEW.id
  LIMIT 1;

  IF hit IS NOT NULL THEN
    RAISE EXCEPTION 'Pincode % already has "%" — same pincode + area', NEW.pincode, hit
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pincode_directory_block_dup ON public.pincode_directory;
CREATE TRIGGER trg_pincode_directory_block_dup
  BEFORE INSERT OR UPDATE OF pincode, locality ON public.pincode_directory
  FOR EACH ROW EXECUTE FUNCTION public.pincode_directory_block_dup();
