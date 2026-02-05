import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FELTED_STYLE_PREFIX = `Professional needle-felted wool character for a stop-motion animated children's show. High-quality handcrafted felted wool figure with warm personality. Oval egg-shaped face that is slightly narrow with a soft round chin. Thin delicate curved eyebrow lines made from single strands of darker wool. Small solid black glossy bead eyes with no whites visible, set close together and positioned in the lower half of the face. A small but clearly visible rounded nose bump. A small gentle subtle smile, not wide. Smooth uniform cream-colored felted wool skin with very faint barely-there freckles. Hair is compact tightly-packed wool fiber clumps with minimal stray fibers. Body has soft natural child-like proportions. Chunky brown wool boots that connect directly to the dress hem with minimal leg visible. Clothing has minimal simple embroidery, just one small flower. Photographed with a macro lens, shallow depth of field, warm golden-hour natural light, soft green bokeh background.`;

// 4 angle variations: side, back, expressive faces
const ANGLE_SUFFIXES = [
  "Side profile view of the EXACT same felted doll character, showing the profile of the face, same wool colors, same outfit, same hair style. Full body visible from head to toe.",
  "Back view of the EXACT same felted doll character, showing the back of the head and outfit details from behind. Same wool colors and proportions. Full body visible.",
  "The EXACT same felted doll character with a happy excited expression, eyes slightly wider, bigger smile showing joy. Same outfit and colors. Upper body and face clearly visible.",
  "The EXACT same felted doll character with a curious thoughtful expression, head tilted slightly, gentle wondering look. Same outfit and colors. Upper body and face clearly visible.",
];

interface OpenAIImageResponse {
  data: Array<{ b64_json?: string; url?: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured. Please add your OpenAI API key in project secrets." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { character_name, character_description, primary_image_url, project_id, character_id } = await req.json();
    
    if (!character_name || !character_description) {
      throw new Error("character_name and character_description are required");
    }

    if (!primary_image_url) {
      throw new Error("primary_image_url is required for consistent angle generation");
    }

    if (!project_id || !character_id) {
      throw new Error("project_id and character_id are required for storage");
    }

    console.log("Generating consistent angles for character:", character_name);
    console.log("Using primary image as reference:", primary_image_url);

    // Download the primary image to use as reference
    console.log("Downloading primary image for reference...");
    const imageResponse = await fetch(primary_image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download primary image: ${imageResponse.status}`);
    }
    const primaryImageBuffer = await imageResponse.arrayBuffer();
    const primaryImageBytes = new Uint8Array(primaryImageBuffer);
    const primaryImageContentType = imageResponse.headers.get("content-type") ?? "image/png";
    console.log("Primary image downloaded, bytes:", primaryImageBytes.length, "type:", primaryImageContentType);

    const timestamp = Date.now();
    const generatedPrompts: string[] = [];

    // Generate all angle images in parallel using OpenAI image edit
    const imagePromises = ANGLE_SUFFIXES.map(async (suffix, index) => {
      const fullPrompt = `${FELTED_STYLE_PREFIX}\n\nThis character is ${character_name}, ${character_description}\n\nIMPORTANT: Generate the EXACT same felted doll with identical wool colors, outfit details, proportions, and design as shown in the reference image.\n\n${suffix}`;
      
      console.log(`Generating angle ${index + 1}/${ANGLE_SUFFIXES.length}...`);
      console.log(`Full prompt: ${fullPrompt}`);
      generatedPrompts.push(fullPrompt);
      
      // Use OpenAI's image edit endpoint with the primary image as reference (multipart/form-data)
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", fullPrompt);
      form.append("size", "1024x1024");
      form.append("quality", "high");
      form.append("n", "1");
      form.append(
        "image",
        new Blob([primaryImageBytes], { type: primaryImageContentType }),
        "primary.png",
      );

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          // NOTE: do not set Content-Type here; fetch will set the multipart boundary
        },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error for angle ${index + 1}:`, response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data: OpenAIImageResponse = await response.json();
      console.log(`Angle ${index + 1}/${ANGLE_SUFFIXES.length} generated successfully`);
      
      // Prefer base64 response; fall back to URL if provided
      let binaryData: Uint8Array | null = null;
      const b64Data = data.data[0]?.b64_json;
      const urlData = data.data[0]?.url;

      if (b64Data) {
        binaryData = Uint8Array.from(atob(b64Data), (c) => c.charCodeAt(0));
      } else if (urlData) {
        console.log(`OpenAI returned URL for angle ${index + 1}, downloading...`);
        const tmpResp = await fetch(urlData);
        if (!tmpResp.ok) {
          throw new Error(`Failed to download OpenAI image URL for angle ${index + 1}: ${tmpResp.status}`);
        }
        const tmpBuf = await tmpResp.arrayBuffer();
        binaryData = new Uint8Array(tmpBuf);
      }

      if (!binaryData) {
        throw new Error(`No image data returned for angle ${index + 1}`);
      }
      
      // Upload to Supabase storage with timestamp for cache-busting
      const filePath = `${project_id}/${character_id}/angle_${timestamp}_${index + 1}.png`;
      console.log(`Uploading angle ${index + 1} to storage: ${filePath}`);
      
      const { error: uploadError } = await supabase.storage
        .from("character-images")
        .upload(filePath, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Storage upload error for angle ${index + 1}:`, uploadError);
        throw new Error(`Storage upload error: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("character-images")
        .getPublicUrl(filePath);

      console.log(`Angle ${index + 1} uploaded, URL: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    });

    const imageUrls = await Promise.all(imagePromises);
    
    // Filter out any undefined results
    const validUrls = imageUrls.filter((url): url is string => !!url);
    
    console.log(`Generated ${validUrls.length} consistent angle images successfully`);

    return new Response(
      JSON.stringify({
        images: validUrls,
        prompts: generatedPrompts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Angle generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});