import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FAL_STATUS_BASE = "https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video/requests";

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
        JSON.stringify({ success: true, updates: [], message: "No scenes currently generating" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Polling status for ${generatingScenes.length} scenes`);

    const updates: Array<{ scene_id: string; scene_number: number; status: string; video_url?: string; error?: string }> = [];

    // Poll each scene's status
    for (const scene of generatingScenes) {
      try {
        const statusUrl = `${FAL_STATUS_BASE}/${scene.video_request_id}/status`;
        
        const statusResponse = await fetch(statusUrl, {
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
          const resultUrl = `${FAL_STATUS_BASE}/${scene.video_request_id}`;
          const resultResponse = await fetch(resultUrl, {
            headers: {
              "Authorization": `Key ${FAL_API_KEY}`,
            },
          });

          if (resultResponse.ok) {
            const result = await resultResponse.json();
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
