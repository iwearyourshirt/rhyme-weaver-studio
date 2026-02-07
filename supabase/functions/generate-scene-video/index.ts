import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// LTX Video 2.0 Fast - 30x faster than Kling (~10-30 seconds vs 4-5 minutes)
const VIDEO_MODEL_ENDPOINT = "fal-ai/ltx-2/image-to-video/fast";

// Motion style suffix applied to EVERY video generation
const MOTION_STYLE_SUFFIX = `Very slow, dreamlike camera movement. Extremely gentle and peaceful animation. Soft, calm motion. No sudden movements. Lullaby-like atmosphere. Think Studio Ghibli quiet moments.`;

// fal.ai queue endpoint
const FAL_VIDEO_ENDPOINT = `https://queue.fal.run/${VIDEO_MODEL_ENDPOINT}`;

// Camera movement instructions based on shot type
function getCameraMovementForShotType(shotType: string): string {
  const movements: Record<string, string> = {
    "wide": "Slow establishing pan across the scene.",
    "medium": "Gentle subtle camera movement maintaining framing.",
    "close-up": "Very slow push-in or subtle drift on the subject's face.",
    "extreme-close-up": "Nearly static with the tiniest drift on the detail.",
    "two-shot": "Slow lateral movement keeping both characters in frame.",
    "over-shoulder": "Gentle drift from behind the shoulder toward the subject.",
  };
  return movements[shotType] || movements["medium"];
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) {
      throw new Error("FAL_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { scene_id, project_id, image_url, animation_prompt, scene_description, shot_type, animation_direction } = await req.json();

    if (!scene_id || !project_id || !image_url) {
      throw new Error("Missing required fields: scene_id, project_id, image_url");
    }

    console.log(`Starting video generation for scene ${scene_id}`);
    console.log(`Using model: ${VIDEO_MODEL_ENDPOINT}`);
    console.log(`Shot type: ${shot_type || 'medium'}`);
    console.log(`Animation direction: ${animation_direction || 'none'}`);

    // Get camera movement instruction based on shot type
    const cameraInstruction = getCameraMovementForShotType(shot_type || "medium");

    // Build animation direction prefix (only style matters for video, not visual style)
    const animationPrefix = animation_direction ? `${animation_direction}. ` : "";

    // Construct the motion prompt with animation direction, shot-appropriate camera movement, and calm/peaceful style
    const basePrompt = animation_prompt || scene_description || "";
    const motionPrompt = `${animationPrefix}${cameraInstruction} ${basePrompt}. ${MOTION_STYLE_SUFFIX}`;

    console.log(`Motion prompt: ${motionPrompt.substring(0, 200)}...`);

    // Record generation start time
    const generationStartTime = Date.now();

    // Submit to fal.ai queue (async processing) with timeout
    const falResponse = await fetchWithTimeout(FAL_VIDEO_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: motionPrompt,
        image_url: image_url,
        duration: 6,
        resolution: "1080p",
        fps: 25,
        generate_audio: false,
      }),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error(`fal.ai error: ${falResponse.status} - ${errorText}`);
      throw new Error(`fal.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const falResult = await falResponse.json();
    const requestId = falResult.request_id;

    console.log(`fal.ai request queued with ID: ${requestId}`);

    // Update scene with request ID, generating status, and timestamp
    const { error: updateError } = await supabase
      .from("scenes")
      .update({
        video_status: "generating",
        video_request_id: requestId,
        video_error: null,
        video_status_updated_at: new Date().toISOString(),
      })
      .eq("id", scene_id);

    if (updateError) {
      console.error("Error updating scene:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        model: VIDEO_MODEL_ENDPOINT,
        generation_start_time: generationStartTime,
        message: "Video generation queued successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-scene-video:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
