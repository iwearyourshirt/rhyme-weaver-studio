import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
 
const FELTED_STYLE_PREFIX = `Professional needle-felted wool character for a stop-motion animated children's show. High-quality handcrafted felted wool figure with visible wool fiber texture. Photographed with a macro lens, shallow depth of field, warm golden-hour natural light, soft green bokeh background. Always show the full character from top to bottom, never cropped.`;
 
const POSE_SUFFIXES = [
  "Front view of the character, entire figure visible on felted wool grass.",
  "The character shown from a slightly elevated angle, soft blurred background.",
];
 
interface OpenAIImageResponse {
  data: Array<{ b64_json: string }>;
}

// Cost logging helper - gpt-image-1: $0.04 (medium), $0.08 (high)
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

    const { character_name, character_description, project_id, character_id } = await req.json();
     
    if (!character_name || !character_description) {
      throw new Error("character_name and character_description are required");
    }

    if (!project_id || !character_id) {
      throw new Error("project_id and character_id are required for storage");
    }
 
    console.log("Generating images for character:", character_name);
    
    // Generate timestamp for cache-busting
    const timestamp = Date.now();
 
    const basePrompt = `${FELTED_STYLE_PREFIX}\n\nThis character is ${character_name}, ${character_description}`;
 
    // Generate images in parallel
    const generatedPrompts: string[] = [];
    
    const imagePromises = POSE_SUFFIXES.map(async (suffix, index) => {
      const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
      console.log(`Generating image ${index + 1}/${POSE_SUFFIXES.length}...`);
      console.log(`Full prompt: ${fullPrompt}`);
      generatedPrompts.push(fullPrompt);
       
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: fullPrompt,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        }),
      });
 
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error for image ${index + 1}:`, response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
 
      const data: OpenAIImageResponse = await response.json();
      console.log(`Image ${index + 1}/${POSE_SUFFIXES.length} generated successfully`);
       
      const b64Data = data.data[0]?.b64_json;
      if (!b64Data) {
        throw new Error(`No image data returned for image ${index + 1}`);
      }

      // Convert base64 to binary
      const binaryData = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));
       
      // Upload to Supabase storage
      const filePath = `${project_id}/${character_id}/${timestamp}_${index + 1}.png`;
      console.log(`Uploading image ${index + 1} to storage: ${filePath}`);
       
      const { error: uploadError } = await supabase.storage
        .from("character-images")
        .upload(filePath, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Storage upload error for image ${index + 1}:`, uploadError);
        throw new Error(`Storage upload error: ${uploadError.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("character-images")
        .getPublicUrl(filePath);

      console.log(`Image ${index + 1} uploaded, URL: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    });
 
    const imageUrls = await Promise.all(imagePromises);
     
    // Filter out any undefined results
    const validUrls = imageUrls.filter((url): url is string => !!url);
     
    console.log(`Generated ${validUrls.length} images successfully`);

    // Log AI cost - $0.04 per image (medium quality gpt-image-1)
    const totalCost = validUrls.length * 0.04;
    await logAICost(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      project_id,
      "openai-gpt-image-1",
      `Generate ${validUrls.length} character images for ${character_name}`,
      totalCost
    );
 
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
    console.error("Image generation error:", error);
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