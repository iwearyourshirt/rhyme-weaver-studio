

# Tighten Character and Environment References in Storyboard Generation

## The Problem

Looking at the current storyboard data, the issues are clear:

- Scenes 3, 4, 5, 7, 8, 10 all have **empty** `characters_in_scene` arrays despite clearly featuring Webster
- Image prompts say "a felted spider" or "the spider" instead of **"Webster"**
- Environments like "The Garden" and "English Cottage" are never referenced by name -- prompts say "felted wool landscape" instead
- Lavender (Webster's wife) never appears despite being a defined character

The root cause is in the system prompt instructions sent to GPT-4o. The current instructions tell the AI to write "a complete image generation prompt that combines the project's visual style with the scene description and character descriptions" -- this encourages the AI to re-describe characters generically rather than use their actual names.

## The Fix

Update the `generate-storyboard` edge function's prompt instructions to enforce strict character and environment naming rules.

### Changes to `supabase/functions/generate-storyboard/index.ts`

**1. Add explicit naming rules to the system message:**

Add rules that tell GPT-4o:
- Always use character names (e.g., "Webster", "Avery", "Lavender") -- never generic descriptions like "the spider" or "a young girl"
- Always use environment names (e.g., "The Garden", "English Cottage") -- never generic descriptions like "a garden" or "a cottage"
- Every scene MUST have a non-empty `characters_in_scene` array (at minimum the protagonist should appear in most scenes)
- The image generation system has reference images for all characters and environments, so names are sufficient for visual consistency

**2. Update the image_prompt instruction (line 246):**

Change from:
> "a complete image generation prompt that combines the project's visual style with the scene description and character descriptions"

To something like:
> "a concise image generation prompt. Reference characters and environments BY NAME (e.g., 'Webster climbs the spout' not 'a felted spider climbs'). The image system has reference images for all characters/environments, so names alone ensure visual consistency. Focus on composition, action, and framing."

**3. Update the animation_prompt instruction similarly** to use character names, not generic descriptions.

**4. Add a character/environment name reminder at the end of the user message:**

After the lyrics section, add a block like:
```
IMPORTANT - CHARACTER & ENVIRONMENT NAMING RULES:
- Available characters: Webster, Avery, Lavender
- Available environments: English Cottage, The Garden
- ALWAYS use these exact names in scene_description, image_prompt, animation_prompt, and characters_in_scene
- NEVER use generic descriptions like "the spider", "a girl", "a garden" -- use the character/environment name
- Every scene should have at least one character in characters_in_scene
```

This dynamically lists all character and environment names so the AI has a clear reference.

## What Stays the Same

- Cinematic shot type variety (wide, close-up, two-shot, etc.) -- no changes
- Creative brief / style direction handling -- no changes
- Scene structure (one per lyric line) -- no changes
- The rest of the pipeline (image generation, video generation) -- no changes

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-storyboard/index.ts` | Update system prompt and user message instructions to enforce character/environment naming |

## Technical Details

The key prompt changes:

**System message addition:**
```
When writing scene descriptions and prompts, ALWAYS refer to characters and environments 
by their exact names. Never use generic descriptions like "the spider" or "a garden" — 
use "Webster" and "The Garden". The image generation pipeline uses reference images keyed 
to these names, so using exact names is critical for visual consistency.
```

**User message -- replace image_prompt instruction:**
```
- image_prompt (a concise prompt for image generation. Reference all characters and 
  environments BY THEIR EXACT NAMES — never generic descriptions. The image system has 
  reference images for each character/environment, so names ensure consistency. Focus on 
  action, composition, shot framing, and mood.)
```

**User message -- dynamic name reminder appended after instructions:**
```
CRITICAL NAMING RULES:
- Character names to use: [Webster, Avery, Lavender]
- Environment names to use: [English Cottage, The Garden]  
- ALWAYS use these exact names in ALL fields. Never say "the spider" — say "Webster".
- characters_in_scene must list every character visible in that scene.
```

