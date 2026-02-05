 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 const FELTED_STYLE_PREFIX = `Handcrafted felted wool animation style. Soft, fuzzy textures like needle-felted wool toys. Warm, cozy lighting with gentle shadows. Colors are muted but warm — soft oranges, deep teals, cream whites, forest greens. Characters have simple, sweet faces with small dot eyes and subtle smiles. Backgrounds look like layered felt with visible soft texture. The overall aesthetic is a cozy children's storybook brought to life through stop-motion felt animation.`;
 
 // Angle variations to generate - consistent with the character but from different views
 const ANGLE_SUFFIXES = [
   "Side profile view, looking to the left, same character design and colors.",
   "Three-quarter back view, looking over shoulder, same character design and colors.",
   "Back view, same character design and colors, showing from behind.",
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
 
     const basePrompt = `${FELTED_STYLE_PREFIX}\n\nCharacter: ${character_name} - ${character_description}\n\nIMPORTANT: Generate the EXACT same character with identical colors, proportions, and design details. Maintain perfect consistency.`;
 
     // Generate all angle images in parallel
     const imagePromises = ANGLE_SUFFIXES.map(async (suffix, index) => {
       const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
       console.log(`Generating angle ${index + 1}/${ANGLE_SUFFIXES.length}...`);
       
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