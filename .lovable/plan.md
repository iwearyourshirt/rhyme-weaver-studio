
# Storyboard Scene Image Generation with 3:2 Aspect Ratio

## Overview
Create a new edge function `generate-scene-image` that uses OpenAI's `gpt-image-1` model with `1536x1024` resolution (3:2 aspect ratio) for generating scene images from the storyboard. Update the ImageGeneration page to use this edge function instead of placeholder images.

## Current State
- The ImageGeneration page uses **placeholder/mock images** (lines 48-58)
- Character images use `gpt-image-1` at `1024x1024` (square) - this stays unchanged
- Storage buckets exist: `audio`, `character-images`
- `OPENAI_API_KEY` secret is already configured

## Implementation Plan

### 1. Create Storage Bucket for Scene Images
Create a new public storage bucket `scene-images` via SQL migration with appropriate RLS policies for public read access.

### 2. Create Edge Function: `generate-scene-image`

**Location:** `supabase/functions/generate-scene-image/index.ts`

**Input:**
- `scene_id` - the scene to generate an image for
- `project_id` - for storage path organization

**Logic:**
1. Fetch the scene record to get `image_prompt`
2. Call OpenAI API with:
   - Model: `gpt-image-1`
   - Size: `1536x1024` (3:2 landscape ratio)
   - Quality: `medium`
3. Upload generated image to `scene-images` bucket
4. Update scene record with new `image_url` and set `image_status` to `done`
5. Return the image URL

**Key Difference from Character Images:**
| Property | Character Images | Scene Images |
|----------|-----------------|--------------|
| Size | 1024x1024 | 1536x1024 |
| Aspect | 1:1 (square) | 3:2 (landscape) |
| Bucket | character-images | scene-images |

### 3. Update Config
Add `generate-scene-image` function entry to `supabase/config.toml`

### 4. Update ImageGeneration Page

**Changes to `src/pages/ImageGeneration.tsx`:**

1. **Replace mock generation with edge function call:**
   - Remove placeholder image logic
   - Call `generate-scene-image` edge function via `supabase.functions.invoke()`

2. **Update aspect ratio:**
   - Change `aspect-square` to `aspect-[3/2]` on scene cards for proper 3:2 display

3. **Add debug logging:**
   - Log the full API request/response to the debug panel

4. **Keep existing features:**
   - Generate All button
   - Individual generate/regenerate buttons
   - Progress tracking
   - Status badges

## Technical Details

### Edge Function Structure
```text
generate-scene-image/
  index.ts
```

### API Flow
```text
ImageGeneration Page
        |
        v
generate-scene-image (Edge Function)
        |
        +--> Fetch scene from DB (get image_prompt)
        |
        +--> OpenAI API (gpt-image-1, 1536x1024, medium)
        |
        +--> Upload to scene-images bucket
        |
        +--> Update scene record (image_url, image_status)
        |
        v
Return image URL
```

### Storage Path Format
`{project_id}/{scene_id}/{timestamp}.png`

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| SQL Migration | Create | scene-images storage bucket + RLS |
| `supabase/functions/generate-scene-image/index.ts` | Create | Edge function for scene image generation |
| `supabase/config.toml` | Modify | Add function entry |
| `src/pages/ImageGeneration.tsx` | Modify | Use edge function, update aspect ratio |
