

# Edge Function Audit and Fix Plan

## Summary of Issues Found

After reviewing all 9 edge functions, I found **2 systemic problems** causing repeated breakage, plus several smaller inconsistencies.

---

## Problem 1: CORS Headers Are Inconsistent (Root Cause of Most Failures)

Two functions use **incomplete CORS headers**, which causes the browser to block requests silently and show "Failed to fetch" errors:

| Function | CORS Headers | Status |
|---|---|---|
| transcribe-audio | Full headers | OK |
| generate-character-images | Full headers | OK |
| generate-consistent-angles | Full headers | OK |
| generate-storyboard | Full headers | OK |
| generate-scene-image | Full headers | OK |
| rewrite-prompt | Full headers | OK |
| **generate-scene-video** | **Missing extended headers** | BROKEN |
| **poll-video-status** | **Missing extended headers** | BROKEN |
| **cancel-video-generation** | Full headers | OK |

`generate-scene-video` and `poll-video-status` both use the short CORS header set:
```
"authorization, x-client-info, apikey, content-type"
```

They are missing the `x-supabase-client-*` headers that the Supabase JS SDK sends automatically. This causes CORS preflight failures depending on browser/SDK version.

### Fix
Update both functions to use the full CORS header set:
```
"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

---

## Problem 2: Functions Not Deployed After Code Changes

Every time code is edited, edge functions must be explicitly redeployed. This has caused repeated "Failed to fetch" errors across sessions. The fix is to **redeploy all 9 functions** as a batch after making the CORS fixes.

---

## Problem 3: Duplicated Cost Logging Helper

The `logAICost` helper function is copy-pasted identically across 4 functions (generate-scene-image, generate-storyboard, generate-character-images, poll-video-status). While not a runtime bug, it means any cost-tracking fix must be applied in 4 places. This is acceptable for edge functions (no shared imports), but worth noting for maintenance.

---

## Per-Function Status and Fixes

### 1. `transcribe-audio`
- **CORS**: OK (full headers)
- **API**: fal.ai Whisper -- OK
- **Error handling**: OK
- **Fix needed**: None

### 2. `generate-character-images`
- **CORS**: OK
- **API**: OpenAI gpt-image-1 -- OK
- **Cost logging**: OK
- **Fix needed**: None

### 3. `generate-consistent-angles`
- **CORS**: OK
- **API**: OpenAI gpt-image-1 edits -- OK
- **Cost logging**: Missing (no cost logged for angle generation)
- **Fix needed**: Add cost logging (same as character images: $0.04 per image x 3 angles = $0.12)

### 4. `generate-storyboard`
- **CORS**: OK
- **API**: OpenAI GPT-4o -- OK
- **Cost logging**: OK (token-based)
- **Fix needed**: None

### 5. `generate-scene-image`
- **CORS**: OK
- **API**: OpenAI gpt-image-1 -- OK
- **Background processing**: Uses EdgeRuntime.waitUntil -- OK
- **Cost logging**: OK
- **Fix needed**: None

### 6. `rewrite-prompt`
- **CORS**: OK
- **API**: Lovable AI Gateway (Gemini) -- OK
- **Cost logging**: Missing (no cost logged, but Lovable gateway calls are free)
- **Fix needed**: None

### 7. `generate-scene-video` -- NEEDS FIX
- **CORS**: BROKEN (short headers)
- **API**: fal.ai LTX Video -- OK
- **Cost logging**: Not here (done in poll-video-status) -- OK
- **Fix needed**: Update CORS headers to full set

### 8. `poll-video-status` -- NEEDS FIX
- **CORS**: BROKEN (short headers)
- **API**: fal.ai queue status -- OK
- **Cost logging**: OK
- **Fix needed**: Update CORS headers to full set

### 9. `cancel-video-generation`
- **CORS**: OK
- **API**: fal.ai queue cancel -- OK
- **Fix needed**: None

---

## Implementation Steps

1. **Fix `generate-scene-video/index.ts`**: Replace the short CORS headers with the full set
2. **Fix `poll-video-status/index.ts`**: Replace the short CORS headers with the full set
3. **Fix `generate-consistent-angles/index.ts`**: Add cost logging ($0.04 x 3 = $0.12 per call)
4. **Deploy ALL 9 functions in a single batch** to ensure nothing is left undeployed

These are small, surgical changes -- just the CORS header strings on 2 files, cost logging on 1 file, and a full redeploy.

