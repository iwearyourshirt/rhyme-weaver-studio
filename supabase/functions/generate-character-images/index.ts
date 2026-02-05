 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 const FELTED_STYLE_PREFIX = `Handcrafted felted wool animation style. Soft, fuzzy textures like needle-felted wool toys. Warm, cozy lighting with gentle shadows. Colors are muted but warm — soft oranges, deep teals, cream whites, forest greens. Characters have simple, sweet faces with small dot eyes and subtle smiles. Backgrounds look like layered felt with visible soft texture. The overall aesthetic is a cozy children's storybook brought to life through stop-motion felt animation.`;
 
 const POSE_SUFFIXES = [
   "Full body view, facing camera, standing in neutral pose.",
   "Upper body portrait, slight smile, looking warmly at viewer.",
   "Full body, gentle walking pose, three-quarter view.",
   "Close-up face portrait, gentle expression, soft focus background.",
 ];
 
 interface FluxResponse {
   images: Array<{ url: string }>;
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
     if (!FAL_API_KEY) {
       throw new Error("FAL_API_KEY is not configured");
     }
 
     const { character_name, character_description } = await req.json();
     
     if (!character_name || !character_description) {
       throw new Error("character_name and character_description are required");
     }
 
     console.log("Generating images for character:", character_name);
 
     const basePrompt = `${FELTED_STYLE_PREFIX}\n\nCharacter: ${character_name} - ${character_description}`;
 
     // Generate all 4 images in parallel
     const imagePromises = POSE_SUFFIXES.map(async (suffix, index) => {
       const fullPrompt = `${basePrompt}\n\n${suffix}`;
       
       console.log(`Generating image ${index + 1}/4...`);
       
       const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
         method: "POST",
         headers: {
           "Authorization": `Key ${FAL_API_KEY}`,
           "Content-Type": "application/json",
         },
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