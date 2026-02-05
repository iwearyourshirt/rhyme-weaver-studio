 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
const FELTED_STYLE_PREFIX = `Needle-felted wool doll photographed with macro lens. Tiny handmade wool figure with rough matte felted texture showing individual poked wool fibers. Very simple face with only tiny black bead eyes and a barely visible small smile, no rosy cheeks, no eyelashes, no face paint. Chunky stubby proportions like a toddler toy. Hair made of thick clumps of wool fiber, not individual strands. Clean simple soft-focus green or neutral background with no props or objects. Natural daylight, shallow depth of field.`;
 
 const POSE_SUFFIXES = [
  "Front view of the felted doll, full body visible, standing on felted wool grass.",
  "The felted doll shown from a slightly elevated angle, upper body and face clearly visible, soft blurred background.",
  "The felted doll in a gentle action pose, arms slightly raised, three-quarter view, standing on felted surface.",
  "Extreme close-up macro shot of the felted doll's face, showing wool fiber texture detail, black bead eyes, shallow depth of field.",
 ];
 
 interface FluxResponse {
   images: Array<{ url: string }>;
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
     if (!FAL_API_KEY) {
      console.error("FAL_API_KEY is not set in environment variables");
      return new Response(
        JSON.stringify({ error: "FAL_API_KEY is not configured. Please add your fal.ai API key in project secrets." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
     }
 
    // Sanitize the API key - remove any whitespace or newlines
    const cleanApiKey = FAL_API_KEY.trim();
    console.log("FAL_API_KEY length:", cleanApiKey.length);

     const { character_name, character_description } = await req.json();
     
     if (!character_name || !character_description) {
       throw new Error("character_name and character_description are required");
     }
 
     console.log("Generating images for character:", character_name);
 
    const basePrompt = `${FELTED_STYLE_PREFIX}\n\nThis felted doll depicts ${character_name}, ${character_description}`;
 
     // Generate all 4 images in parallel
    const generatedPrompts: string[] = [];
    
    const imagePromises = POSE_SUFFIXES.map(async (suffix, index) => {
       const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
       console.log(`Generating image ${index + 1}/4...`);
      console.log(`Full prompt: ${fullPrompt}`);
      generatedPrompts.push(fullPrompt);
       
      const requestHeaders = new Headers({
        "Content-Type": "application/json",
        "Authorization": `Key ${cleanApiKey}`,
      });
      
      const response = await fetch("https://fal.run/fal-ai/flux-pro/v1.1", {
         method: "POST",
        headers: requestHeaders,
         body: JSON.stringify({
           prompt: fullPrompt,
           image_size: "square",
           num_images: 1,
           enable_safety_checker: true,
         }),
       });
 
       if (!response.ok) {
         const errorText = await response.text();
         console.error(`Flux API error for image ${index + 1}:`, response.status, errorText);
         throw new Error(`Flux API error: ${response.status} - ${errorText}`);
       }
 
       const data: FluxResponse = await response.json();
       console.log(`Image ${index + 1}/4 generated successfully`);
       
       return data.images[0]?.url;
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