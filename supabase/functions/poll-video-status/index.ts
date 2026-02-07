import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VIDEO_MODEL_ENDPOINT = "fal-ai/ltx-2/image-to-video/fast";
const VIDEO_MODEL_BASE = "fal-ai/ltx-2";
const VIDEO_COST_PER_CLIP = 0.24;
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 15000;

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
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

// Cost logging helper
async function logAICost(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  service: string,
  operation: string,
  cost: number
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/cost_logs`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        project_id: projectId,
        service,
        operation,
        cost,
        tokens_input: null,
        tokens_output: null,
      }),
    });

    const projectResp = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=total_ai_cost`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });
    const projectData = await projectResp.json();
    const currentTotal = Number(projectData?.[0]?.total_ai_cost || 0);

    await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ total_ai_cost: currentTotal + cost }),
    });

    console.log(`Logged AI cost: ${service} - $${cost.toFixed(4)}`);
  } catch (error) {
    console.error("Failed to log AI cost:", error);
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

    const { project_id } = await req.json();

    if (!project_id) {
      throw new Error("Missing required field: project_id");
    }

    // Get all scenes that are currently generating
    const { data: generatingScenes, error: fetchError } = await supabase
      .from("scenes")
      .select("id, scene_number, video_request_id, video_status_updated_at")
      .eq("project_id", project_id)
      .eq("video_status", "generating")
      .not("video_request_id", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    if (!generatingScenes || generatingScenes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          updates: [],
          model: VIDEO_MODEL_ENDPOINT,
          message: "No scenes currently generating",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Polling status for ${generatingScenes.length} scenes using ${VIDEO_MODEL_ENDPOINT}`);

    const updates: Array<{
      scene_id: string;
      scene_number: number;
      status: string;
      video_url?: string;
      error?: string;
    }> = [];

    const now = Date.now();

    // Poll each scene's status — per-scene error isolation
    for (const scene of generatingScenes) {
      try {
        // Fix 3: Stuck scene recovery
        if (scene.video_status_updated_at) {
          const updatedAt = new Date(scene.video_status_updated_at).getTime();
          if (now - updatedAt > STUCK_THRESHOLD_MS) {
            console.log(`Scene ${scene.scene_number} stuck for >5min, resetting to pending`);
            await supabase
              .from("scenes")
              .update({
                video_status: "pending",
                video_request_id: null,
                video_error: "Generation timed out - please retry",
                video_status_updated_at: new Date().toISOString(),
              })
              .eq("id", scene.id);

            updates.push({
              scene_id: scene.id,
              scene_number: scene.scene_number,
              status: "failed",
              error: "Generation timed out - please retry",
            });
            continue; // Skip fal.ai check for this scene
          }
        }

        const statusUrl = `https://queue.fal.run/${VIDEO_MODEL_BASE}/requests/${scene.video_request_id}/status`;
        console.log(`Checking status at: ${statusUrl}`);

        const statusResponse = await fetchWithTimeout(statusUrl, {
          method: "GET",
          headers: { "Authorization": `Key ${FAL_API_KEY}` },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(`Status check failed for scene ${scene.id}: ${statusResponse.status} - ${errorText}`);
          continue; // Don't mark as failed on network issues, just retry next poll
        }

        const statusResult = await statusResponse.json();
        console.log(`Scene ${scene.scene_number} status:`, statusResult.status);

        if (statusResult.status === "COMPLETED") {
          const resultUrl = `https://queue.fal.run/${VIDEO_MODEL_BASE}/requests/${scene.video_request_id}`;
          const resultResponse = await fetchWithTimeout(resultUrl, {
            method: "GET",
            headers: { "Authorization": `Key ${FAL_API_KEY}` },
          });

          if (resultResponse.ok) {
            const result = await resultResponse.json();
            const videoUrl = result.video?.url;

            if (videoUrl) {
              // Dedup guard: only update if scene is still 'generating'
              const { data: updateResult, error: updateError } = await supabase
                .from("scenes")
                .update({
                  video_status: "done",
                  video_url: videoUrl,
                  video_error: null,
                  video_status_updated_at: new Date().toISOString(),
                })
                .eq("id", scene.id)
                .eq("video_status", "generating")
                .select("id");

              if (updateError || !updateResult || updateResult.length === 0) {
                console.log(`Scene ${scene.scene_number} already processed by another poll, skipping cost log`);
                continue;
              }

              await logAICost(supabaseUrl, supabaseKey, project_id, "fal-ltx-video-fast", `Video clip scene ${scene.scene_number}`, VIDEO_COST_PER_CLIP);

              updates.push({
                scene_id: scene.id,
                scene_number: scene.scene_number,
                status: "done",
                video_url: videoUrl,
              });

              console.log(`Scene ${scene.scene_number} video completed: ${videoUrl}`);
            }
          }
        } else if (statusResult.status === "FAILED") {
          const errorMessage = statusResult.error || "Video generation failed";

          await supabase
            .from("scenes")
            .update({
              video_status: "failed",
              video_error: errorMessage,
              video_status_updated_at: new Date().toISOString(),
            })
            .eq("id", scene.id);

          updates.push({
            scene_id: scene.id,
            scene_number: scene.scene_number,
            status: "failed",
            error: errorMessage,
          });

          console.log(`Scene ${scene.scene_number} failed: ${errorMessage}`);
        }
        // If IN_QUEUE or IN_PROGRESS, do nothing - will check again next poll
      } catch (pollError) {
        // Fix 1: Per-scene error isolation — log and continue
        console.error(`Error polling scene ${scene.id}:`, pollError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updates,
        model: VIDEO_MODEL_ENDPOINT,
        still_generating: generatingScenes.length - updates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in poll-video-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
