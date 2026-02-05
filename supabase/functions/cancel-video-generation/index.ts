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

    const { scene_id, request_id } = await req.json();

    if (!scene_id) {
      throw new Error("Missing required field: scene_id");
    }

    console.log(`Cancelling video generation for scene ${scene_id}`);

    // If we have a request_id, try to cancel it on fal.ai
    if (request_id) {
      try {
        const cancelUrl = `https://queue.fal.run/${VIDEO_MODEL_ENDPOINT}/requests/${request_id}/cancel`;
        
        const cancelResponse = await fetch(cancelUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Key ${FAL_API_KEY}`,
          },
        });

        if (cancelResponse.ok) {
          console.log(`Successfully cancelled fal.ai request ${request_id}`);
        } else {
          // Log but don't fail - the request might already be completed or not exist
          console.log(`fal.ai cancel returned ${cancelResponse.status} - proceeding to update scene status`);
        }
      } catch (cancelError) {
        // Log but don't fail - we still want to update the scene status
        console.error(`Error cancelling fal.ai request:`, cancelError);
      }
    }

    // Update scene to pending status (resetting it)
    const { error: updateError } = await supabase
      .from("scenes")
      .update({
        video_status: "pending",
        video_request_id: null,
        video_error: null,
        video_url: null,
      })
      .eq("id", scene_id);

    if (updateError) {
      console.error("Error updating scene:", updateError);
      throw updateError;
    }

    console.log(`Scene ${scene_id} reset to pending status`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Video generation cancelled successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in cancel-video-generation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
