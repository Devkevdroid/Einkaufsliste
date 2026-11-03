-- Unsere übliche Portionszahl ist 2 (die App setzt sie selbst; das hier ist nur der passende Standardwert).
alter table public.recipes alter column servings set default 2;
