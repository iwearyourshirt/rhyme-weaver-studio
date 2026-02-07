import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
interface Character {
  id: string;
  name: string;
  primary_image_url: string | null;
  character_type: string | null;
}

interface DownloadedImage {
  name: string;
  bytes: Uint8Array;
  mimeType: string;
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

async function downloadImage(url: string, name: string): Promise<DownloadedImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download image from ${url}: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    return { name, bytes: uint8Array, mimeType: contentType };
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return null;
  }
}

// Shot type to camera framing instruction mapping
function getShotTypeInstruction(shotType: string): string {
  const instructions: Record<string, string> = {
    "wide": "Frame as a wide establishing shot showing the full environment and all characters from a distance.",
    "medium": "Frame as a medium shot from the waist up, balancing character detail with environmental context.",
    "close-up": "Frame as a close-up shot focusing tightly on the character's face and upper body, emphasizing emotion and detail.",
    "extreme-close-up": "Frame as an extreme close-up on a specific detail - eyes, hands, or a key object - filling the frame.",
    "two-shot": "Frame as a two-shot with both characters prominently featured together in the frame.",
    "over-shoulder": "Frame as an over-the-shoulder shot, viewing one character from behind another's shoulder.",
  };
  return instructions[shotType] || instructions["medium"];
}
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
   
   const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
   const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
   
   try {
     const { scene_id } = await req.json();
     
     if (!scene_id) {
       return new Response(
         JSON.stringify({ error: "scene_id is required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     console.log(`Generating scene image for scene ${scene_id}`);
     
     const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
     if (!openaiApiKey) {
       console.error("OPENAI_API_KEY is not configured");
       return new Response(
         JSON.stringify({ error: "OpenAI API key not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Fetch the scene
     const { data: scene, error: sceneError } = await supabase
       .from("scenes")
       .select("image_prompt, project_id, characters_in_scene, shot_type")
       .eq("id", scene_id)
       .single();
     
     if (sceneError || !scene) {
       console.error("Failed to fetch scene:", sceneError);
       return new Response(
         JSON.stringify({ error: "Scene not found" }),
         { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Set status to "generating" immediately
     await supabase
       .from("scenes")
       .update({ image_status: "generating" })
       .eq("id", scene_id);
     
     // Return immediately — the heavy work happens in the background
     // EdgeRuntime.waitUntil keeps the function alive after sending the response
     const backgroundWork = (async () => {
       try {
         const shotType = scene.shot_type || "medium";
         console.log(`[BG] Image prompt: ${scene.image_prompt}`);
         console.log(`[BG] Shot type: ${shotType}`);
         
         // Fetch project creative direction
         const { data: project } = await supabase
           .from("projects")
           .select("style_direction, cinematography_direction")
           .eq("id", scene.project_id)
           .single();
         
         const styleDirection = project?.style_direction || "";
         const cinematographyDirection = project?.cinematography_direction || "";
         
         // Fetch ALL characters for this project
         const { data: characters } = await supabase
           .from("characters")
           .select("id, name, primary_image_url, character_type")
           .eq("project_id", scene.project_id);
         
         const charList = (characters || []) as Character[];
         console.log(`[BG] Found ${charList.length} characters in project`);
         
          // Determine which characters to include based on PROMPT TEXT only
           // characters_in_scene can be stale — the prompt is the source of truth for reference images
           const promptLowerForCharScan = scene.image_prompt.toLowerCase();
            const referenceImages: DownloadedImage[] = [];
            const includedCharacters: string[] = [];
            
            // Fuzzy name matching: check if any significant keyword from the character name
            // appears in the prompt. This allows "cottage", "the cottage", "english cottage"
            // to all match a character named "Cottage" or "The Cottage".
            const STOP_WORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "and", "or", "is", "it"]);
            
            function nameMatchesPrompt(name: string, promptLower: string): boolean {
              // First check exact full-name match (case-insensitive)
              if (promptLower.includes(name.toLowerCase())) return true;
              
              // Then check if any significant keyword from the name appears as a whole word in the prompt
              const keywords = name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
              for (const keyword of keywords) {
                // Use word boundary matching to avoid false positives (e.g. "art" matching "cart")
                const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
                if (regex.test(promptLower)) return true;
              }
              return false;
            }
            
            // Track whether any actual characters (non-environment) are included
            let hasNonEnvironmentReference = false;
            
            for (const char of charList) {
              const isEnvironment = char.character_type === "environment";
              const isInPrompt = nameMatchesPrompt(char.name, promptLowerForCharScan);
             
             // Only include reference image if the character/environment is mentioned by name in the prompt
             if (!isInPrompt) continue;
             if (!char.primary_image_url) continue;
            
            if (!isEnvironment) {
              hasNonEnvironmentReference = true;
            }
            
            console.log(`[BG] Downloading reference image for "${char.name}"`);
            const imageData = await downloadImage(char.primary_image_url, `${char.name.replace(/\s+/g, '_')}.png`);
            
            if (imageData) {
              referenceImages.push(imageData);
              includedCharacters.push(char.name);
            }
          }
          
          // If we ONLY have environment references and no characters, KEEP the references
          // but add an explicit instruction to avoid hallucinating characters/figures
          if (!hasNonEnvironmentReference && referenceImages.length > 0) {
            console.log(`[BG] Environment-only references — keeping them for visual consistency, adding no-character instruction`);
          }
         
         console.log(`[BG] Reference images to send: ${referenceImages.length}`);
         
         // Build prompt
         const shotTypeInstruction = getShotTypeInstruction(shotType);
         const promptLower = scene.image_prompt.toLowerCase();
         const styleAlreadyInPrompt = styleDirection && 
           styleDirection.toLowerCase().split(/\s+/).some((word: string) => 
             word.length > 3 && promptLower.includes(word.toLowerCase())
           );
         
         let stylePrefix = "";
         if (styleDirection && !styleAlreadyInPrompt) {
           stylePrefix = `${styleDirection} style. `;
         }
         let cinematographyPrefix = "";
         if (cinematographyDirection) {
           cinematographyPrefix = `${cinematographyDirection}. `;
         }
         
          let finalPrompt = `${stylePrefix}${cinematographyPrefix}${shotTypeInstruction} ${scene.image_prompt}`;
          if (referenceImages.length > 0) {
            const referenceInstruction = hasNonEnvironmentReference
              ? `Use the provided reference images as character and environment design guides. Match their exact appearance, proportions, colors, and style.`
              : `Use the provided reference images as environment/setting design guides. Match their exact appearance, colors, textures, and style. Do NOT add any characters, people, figures, or creatures — only show the environment/setting itself.`;
            finalPrompt = `${referenceInstruction} ${stylePrefix}${cinematographyPrefix}${shotTypeInstruction} ${scene.image_prompt}`;
          }
         
         console.log(`[BG] Final prompt: ${finalPrompt}`);
         
         // Call OpenAI
         let openaiResponse: Response;
         
         if (referenceImages.length > 0) {
           const formData = new FormData();
           formData.append("model", "gpt-image-1");
           formData.append("prompt", finalPrompt);
           formData.append("size", "1536x1024");
           formData.append("quality", "medium");
           formData.append("n", "1");
           
           for (const refImage of referenceImages) {
             const blob = new Blob([refImage.bytes.buffer as ArrayBuffer], { type: refImage.mimeType });
             formData.append("image[]", blob, refImage.name);
           }
           
           openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
             method: "POST",
             headers: { "Authorization": `Bearer ${openaiApiKey}` },
             body: formData,
           });
         } else {
           openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
             method: "POST",
             headers: {
               "Authorization": `Bearer ${openaiApiKey}`,
               "Content-Type": "application/json",
             },
             body: JSON.stringify({
               model: "gpt-image-1",
               prompt: finalPrompt,
               size: "1536x1024",
               quality: "medium",
               n: 1,
             }),
           });
         }
         
         if (!openaiResponse.ok) {
           const errorText = await openaiResponse.text();
           console.error("[BG] OpenAI API error:", openaiResponse.status, errorText);
           await supabase.from("scenes").update({ image_status: "failed" }).eq("id", scene_id);
           return;
         }
         
         const openaiData = await openaiResponse.json();
         console.log("[BG] OpenAI response received");
         
         const imageResult = openaiData.data?.[0];
         let imageBytes: Uint8Array;
         
         if (imageResult?.b64_json) {
           const binaryString = atob(imageResult.b64_json);
           imageBytes = new Uint8Array(binaryString.length);
           for (let i = 0; i < binaryString.length; i++) {
             imageBytes[i] = binaryString.charCodeAt(i);
           }
         } else if (imageResult?.url) {
           const imageResponse = await fetch(imageResult.url);
           imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
         } else {
           console.error("[BG] No image data in response:", JSON.stringify(openaiData));
           await supabase.from("scenes").update({ image_status: "failed" }).eq("id", scene_id);
           return;
         }
         
         // Upload to storage
         const filePath = `${scene.project_id}/scenes/${scene_id}.png`;
         console.log(`[BG] Uploading to character-images/${filePath}`);
         
         const { error: uploadError } = await supabase.storage
           .from("character-images")
           .upload(filePath, imageBytes, { contentType: "image/png", upsert: true });
         
         if (uploadError) {
           console.error("[BG] Upload error:", uploadError);
           await supabase.from("scenes").update({ image_status: "failed" }).eq("id", scene_id);
           return;
         }
         
         const { data: publicUrlData } = supabase.storage
           .from("character-images")
           .getPublicUrl(filePath);
         
         const imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
         console.log(`[BG] Image uploaded: ${imageUrl}`);
         
         // Log cost
         await logAICost(supabaseUrl, supabaseServiceKey, scene.project_id, "openai-gpt-image-1", `Generate scene ${scene_id.substring(0, 8)} image`, 0.04);
         
         // Update scene with result
         const { error: updateError } = await supabase
           .from("scenes")
           .update({ image_url: imageUrl, image_status: "done" })
           .eq("id", scene_id);
         
         if (updateError) {
           console.error("[BG] Failed to update scene:", updateError);
         } else {
           console.log(`[BG] Scene ${scene_id} updated successfully`);
         }
       } catch (error) {
         console.error("[BG] Background generation error:", error);
         await supabase.from("scenes").update({ image_status: "failed" }).eq("id", scene_id);
       }
     })();
     
     // Keep the function alive for background work
     // @ts-ignore - EdgeRuntime is available in Supabase edge functions
     if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
       EdgeRuntime.waitUntil(backgroundWork);
     }
     
     return new Response(
       JSON.stringify({ status: "generating", scene_id }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Request error:", error);
     const errorMessage = error instanceof Error ? error.message : "Unexpected error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });