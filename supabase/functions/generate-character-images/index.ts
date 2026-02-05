import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
const FELTED_STYLE_PREFIX = `Needle-felted wool character, looks like a real handmade miniature wool figure photographed with a macro lens. Matte felted texture with visible wool fibers. Expressive face with wool fiber eyebrows, dark glossy eyes, a small rounded nose, and a warm smile with personality. Chunky proportions. Hair made of thick wool fiber clumps. Clean soft-focus background. Natural daylight, shallow depth of field.`;
 
 const POSE_SUFFIXES = [
  "Front view of the felted doll, full body visible, standing on felted wool grass.",
  "The felted doll shown from a slightly elevated angle, upper body and face clearly visible, soft blurred background.",
  "The felted doll in a gentle action pose, arms slightly raised, three-quarter view, standing on felted surface.",
  "Extreme close-up macro shot of the felted doll's face, showing wool fiber texture detail, black bead eyes, shallow depth of field.",
 ];
 
interface OpenAIImageResponse {
  data: Array<{ b64_json: string }>;
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
 
    const basePrompt = `${FELTED_STYLE_PREFIX}\n\nThis character is ${character_name}, ${character_description}`;
 
     // Generate all 4 images in parallel
    const generatedPrompts: string[] = [];
    
    const imagePromises = POSE_SUFFIXES.map(async (suffix, index) => {
       const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
       console.log(`Generating image ${index + 1}/4...`);
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
          quality: "high",
          n: 1,
         }),
       });
 
       if (!response.ok) {
         const errorText = await response.text();
          console.error(`OpenAI API error for image ${index + 1}:`, response.status, errorText);
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
       }
 
       const data: OpenAIImageResponse = await response.json();
       console.log(`Image ${index + 1}/4 generated successfully`);
       
       const b64Data = data.data[0]?.b64_json;
       if (!b64Data) {
         throw new Error(`No image data returned for image ${index + 1}`);
       }

       // Convert base64 to binary
       const binaryData = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));
       
       // Upload to Supabase storage
       const filePath = `${project_id}/${character_id}/${index + 1}.png`;
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