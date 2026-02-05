import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// LTX Video 2.0 Fast - same model as generate-scene-video
const VIDEO_MODEL_ENDPOINT = "fal-ai/ltx-2/image-to-video/fast";

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
      .select("id, scene_number, video_request_id")
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
          message: "No scenes currently generating" 
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
      generation_time_ms?: number;
    }> = [];

    // Poll each scene's status
    for (const scene of generatingScenes) {
      try {
        // Correct fal.ai queue status URL format: https://queue.fal.run/{model_id}/requests/{request_id}/status
        const statusUrl = `https://queue.fal.run/${VIDEO_MODEL_ENDPOINT}/requests/${scene.video_request_id}/status`;
        
        const statusResponse = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
          },
        });

        if (!statusResponse.ok) {
          console.error(`Status check failed for scene ${scene.id}: ${statusResponse.status}`);
          continue; // Don't mark as failed on network issues, just retry next poll
        }

        const statusResult = await statusResponse.json();
        console.log(`Scene ${scene.scene_number} status:`, statusResult.status);

        if (statusResult.status === "COMPLETED") {
          // Fetch the actual result
          const resultUrl = `https://queue.fal.run/${VIDEO_MODEL_ENDPOINT}/requests/${scene.video_request_id}`;
          const resultResponse = await fetch(resultUrl, {
            method: "GET",
            headers: {
              "Authorization": `Key ${FAL_API_KEY}`,
            },
          });

          if (resultResponse.ok) {
            const result = await resultResponse.json();
            // LTX Video 2.0 returns video in result.video.url
            const videoUrl = result.video?.url;

            if (videoUrl) {
              await supabase
                .from("scenes")
                .update({
                  video_status: "done",
                  video_url: videoUrl,
                  video_error: null,
                })
                .eq("id", scene.id);

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
        console.error(`Error polling scene ${scene.id}:`, pollError);
        // Don't mark as failed on poll errors, just continue
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
