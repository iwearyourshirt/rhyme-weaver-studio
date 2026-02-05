 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
const FELTED_STYLE_PREFIX = `Miniature needle-felted wool doll, photographed with a macro lens with shallow depth of field. The character is a tiny handmade figure made entirely of felted wool fibers with visible fuzzy texture. Black glass bead eyes, soft rounded proportions, stubby short legs, oversized round head. The entire scene is made of felt and wool materials including the ground, grass, and background elements. Warm natural lighting as if photographed on a crafting table near a window. The aesthetic looks like a real physical stop-motion puppet that you could hold in your hand. Shot with a DSLR camera, f/2.8 aperture, soft bokeh background.`;
 
 // Angle variations to generate - consistent with the character but from different views
 const ANGLE_SUFFIXES = [
  "Side profile of the same felted doll, exact same wool colors and outfit details, photographed on same surface.",
  "Three-quarter back view of the same felted doll, looking over shoulder, same wool colors and proportions.",
  "Back view of the same felted doll, same outfit and hair details visible from behind.",
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
 
     const cleanApiKey = FAL_API_KEY.trim();
 
     const { character_name, character_description, primary_image_url } = await req.json();
     
     if (!character_name || !character_description) {
       throw new Error("character_name and character_description are required");
     }
 
     if (!primary_image_url) {
       throw new Error("primary_image_url is required for consistent angle generation");
     }
 
     console.log("Generating consistent angles for character:", character_name);
     console.log("Using primary image as reference:", primary_image_url);
 
    const basePrompt = `${FELTED_STYLE_PREFIX}\n\nThis felted doll depicts ${character_name}, ${character_description}\n\nIMPORTANT: Generate the EXACT same felted doll with identical wool colors, outfit details, proportions, and design. Maintain perfect consistency with the reference image.`;
 
     // Generate all angle images in parallel
    const generatedPrompts: string[] = [];
    
     const imagePromises = ANGLE_SUFFIXES.map(async (suffix, index) => {
       const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
       console.log(`Generating angle ${index + 1}/${ANGLE_SUFFIXES.length}...`);
      console.log(`Full prompt: ${fullPrompt}`);
      generatedPrompts.push(fullPrompt);
       
       const requestHeaders = new Headers({
         "Content-Type": "application/json",
         "Authorization": `Key ${cleanApiKey}`,
       });
       
       // Use flux/dev with image_url for better consistency with reference image
       const response = await fetch("https://fal.run/fal-ai/flux/dev", {
         method: "POST",
         headers: requestHeaders,
         body: JSON.stringify({
           prompt: fullPrompt,
           image_url: primary_image_url,
           image_size: "square",
           num_images: 1,
           guidance_scale: 3.5,
           num_inference_steps: 28,
           enable_safety_checker: true,
         }),
       });
 
       if (!response.ok) {
         const errorText = await response.text();
         console.error(`Flux API error for angle ${index + 1}:`, response.status, errorText);
         throw new Error(`Flux API error: ${response.status} - ${errorText}`);
       }
 
       const data: FluxResponse = await response.json();
       console.log(`Angle ${index + 1}/${ANGLE_SUFFIXES.length} generated successfully`);
       
       return data.images[0]?.url;
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