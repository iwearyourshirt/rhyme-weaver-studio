

# Fix Rewrite AI: Over-generation, Character Handling, and Auto-save

## Problems to Fix

1. **Over-generation**: The AI pulls characters and details from `scene_description` even though it shouldn't. It re-describes characters instead of just referencing them by name.
2. **Prompt reversion**: Rewritten prompts only live in local state -- refreshing the page loses them because they're never auto-saved to the database.
3. **Character bloat**: The AI writes full character descriptions into prompts. Since the image generation pipeline already has access to character reference images and descriptions, prompts should just use character names.

## Plan

### 1. Auto-save rewritten prompts to the database

When the AI rewrites a prompt, immediately persist it so it survives page refreshes.

**Storyboard page (`src/pages/Storyboard.tsx`)**:
- Change the `onRewrite` callback for both image and animation prompts to call `updateScene.mutateAsync()` with the new prompt, in addition to updating local state via `handleLocalEdit`.

**Image Generation SceneCard (`src/components/image-generation/SceneCard.tsx`)**:
- Change `handlePromptRewritten` to call `onPromptSave({ image_prompt: newPrompt })` automatically after setting local state, so it persists to DB immediately.

### 2. Fix the edge function system prompt to prevent over-generation

**Edge function (`supabase/functions/rewrite-prompt/index.ts`)**:

- Remove `scene_description` from the user message entirely, or limit it to a single-sentence summary. The scene description is the main source of hallucinated details (Avery, windowsill, starry sky).
- Update the system prompt rules:
  - Instruct the AI to reference characters **by name only**, never re-describe their appearance.
  - Make it clear that the image generation pipeline handles visual consistency via reference images -- the prompt just needs names and actions.
  - Strengthen the rule: "Do NOT add any characters, locations, or details not explicitly mentioned in the user's feedback or the current prompt."
- When there's no current prompt and the AI is writing from scratch, provide only the user's feedback as source material (not the full scene description).

### 3. Pass the shot type from local edits (not just DB value)

On the Storyboard page, the `shotType` passed to `PromptFeedback` currently uses `scene.shot_type` (the DB value), but the user may have changed it locally without saving. Update to use the locally-edited value if present.

**Storyboard page**: Change `shotType={scene.shot_type}` to `shotType={sceneEdits[scene.id]?.shot_type ?? scene.shot_type}`.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/rewrite-prompt/index.ts` | Rework system prompt to prevent over-generation; remove/minimize scene_description usage; enforce name-only character references |
| `src/pages/Storyboard.tsx` | Auto-save rewritten prompts to DB; pass locally-edited shot_type to PromptFeedback |
| `src/components/image-generation/SceneCard.tsx` | Auto-save rewritten prompts to DB via `onPromptSave` |

## Technical Details

### Updated system prompt approach

```text
RULES:
1. Reference characters BY NAME ONLY. Never describe their appearance.
   The image generation system has reference images for all characters.
2. Only include characters/elements that appear in:
   - The current prompt (preserve them), OR
   - The user's feedback (add them)
3. Do NOT invent locations, props, or atmospheric details not requested.
4. Respect the selected shot type framing.
5. Keep the prompt concise and focused on composition and action.
```

### Auto-save flow

```text
User clicks Rewrite
    |
    v
Edge function returns new prompt
    |
    +--> Update local state (instant UI update)
    |
    +--> Save to DB via updateScene (persist for refresh)
```

