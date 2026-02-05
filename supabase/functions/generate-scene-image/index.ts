 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
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
 
 interface ReferenceImage {
   type: "base64";
   media_type: string;
   data: string;
 }
 
 async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
   try {
     const response = await fetch(url);
     if (!response.ok) {
       console.error(`Failed to download image from ${url}: ${response.status}`);
       return null;
     }
     
     const contentType = response.headers.get("content-type") || "image/png";
     const arrayBuffer = await response.arrayBuffer();
     const uint8Array = new Uint8Array(arrayBuffer);
     
     // Convert to base64
     let binary = "";
     for (let i = 0; i < uint8Array.length; i++) {
       binary += String.fromCharCode(uint8Array[i]);
     }
     const base64 = btoa(binary);
     
     return { base64, mimeType: contentType };
   } catch (error) {
     console.error(`Error downloading image from ${url}:`, error);
     return null;
   }
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
   
   const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
   const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
   
   let sceneId: string | undefined;
   
   try {
     const { scene_id } = await req.json();
     sceneId = scene_id;
     
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
     
     // Fetch the scene to get the image prompt, project_id, and characters_in_scene
     const { data: scene, error: sceneError } = await supabase
       .from("scenes")
       .select("image_prompt, project_id, characters_in_scene")
       .eq("id", scene_id)
       .single();
     
     if (sceneError || !scene) {
       console.error("Failed to fetch scene:", sceneError);
       return new Response(
         JSON.stringify({ error: "Scene not found" }),
         { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     console.log(`Image prompt: ${scene.image_prompt}`);
     console.log(`Characters in scene: ${JSON.stringify(scene.characters_in_scene)}`);
     
     // Update status to "generating"
     const { error: statusError } = await supabase
       .from("scenes")
       .update({ image_status: "generating" })
       .eq("id", scene_id);
     
     if (statusError) {
       console.error("Failed to update status to generating:", statusError);
     }
     
     // Fetch ALL characters for this project (we need environment chars too)
     const { data: characters, error: charsError } = await supabase
       .from("characters")
       .select("id, name, primary_image_url, character_type")
       .eq("project_id", scene.project_id);
     
     if (charsError) {
       console.error("Failed to fetch characters:", charsError);
     }
     
     const charList = (characters || []) as Character[];
     console.log(`Found ${charList.length} characters in project`);
     
     // Determine which characters to include:
     // 1. Environment characters ALWAYS get included
     // 2. Regular characters only if they appear in characters_in_scene (case-insensitive)
     const charactersInScene = (scene.characters_in_scene || []) as string[];
     const referenceImages: ReferenceImage[] = [];
     const includedCharacters: string[] = [];
     const skippedCharacters: string[] = [];
     const includedAsEnvironment: string[] = [];
     const includedAsCharacterMatch: string[] = [];
     
     // Process all characters
     for (const char of charList) {
       const isEnvironment = char.character_type === "environment";
       const isInScene = charactersInScene.some(
         (name) => name.toLowerCase() === char.name.toLowerCase()
       );
       
       // Include if it's an environment character OR if it's a regular character in the scene
       const shouldInclude = isEnvironment || isInScene;
       
       if (!shouldInclude) {
         console.log(`Character "${char.name}" is not in scene and not environment - skipping`);
         continue;
       }
       
       if (!char.primary_image_url) {
         console.log(`Character "${char.name}" has no reference image - skipping`);
         skippedCharacters.push(char.name);
         continue;
       }
       
       // Download and convert to base64
       console.log(`Downloading reference image for "${char.name}": ${char.primary_image_url}`);
       const imageData = await downloadImageAsBase64(char.primary_image_url);
       
       if (imageData) {
         referenceImages.push({
           type: "base64",
           media_type: imageData.mimeType,
           data: imageData.base64,
         });
         includedCharacters.push(char.name);
         
         if (isEnvironment) {
           includedAsEnvironment.push(char.name);
           console.log(`Added reference image for "${char.name}" (ENVIRONMENT - always included)`);
         } else {
           includedAsCharacterMatch.push(char.name);
           console.log(`Added reference image for "${char.name}" (character match)`);
         }
       } else {
         console.log(`Failed to download reference image for "${char.name}" - skipping`);
         skippedCharacters.push(char.name);
       }
     }
     
     // Also check if any names in characters_in_scene didn't match any character record
     for (const charName of charactersInScene) {
       const matchedChar = charList.find(
         (c) => c.name.toLowerCase() === charName.toLowerCase()
       );
       if (!matchedChar) {
         console.log(`Character "${charName}" from scene not found in character records - skipping`);
         if (!skippedCharacters.includes(charName)) {
           skippedCharacters.push(charName);
         }
       }
     }
     
     console.log(`Reference images to send: ${referenceImages.length}`);
     console.log(`Included characters: ${includedCharacters.join(", ") || "none"}`);
     console.log(`  - As environment: ${includedAsEnvironment.join(", ") || "none"}`);
     console.log(`  - As character match: ${includedAsCharacterMatch.join(", ") || "none"}`);
     console.log(`Skipped characters: ${skippedCharacters.join(", ") || "none"}`);
     
     // Build the prompt with reference image instructions if we have any
     let finalPrompt = scene.image_prompt;
     if (referenceImages.length > 0) {
       finalPrompt = `Use the provided reference images as character and environment design guides. Match their exact appearance, proportions, colors, and style. The environment/setting reference shows the world these characters live in - use it as the backdrop. ${scene.image_prompt}`;
     }
     
     console.log(`Final prompt: ${finalPrompt}`);
     
     // Build the request body
     const requestBody: Record<string, unknown> = {
       model: "gpt-image-1",
       prompt: finalPrompt,
       size: "1536x1024",
       quality: "medium",
       n: 1,
     };
     
     // Add reference images if we have any
     if (referenceImages.length > 0) {
       requestBody.image = referenceImages;
     }
     
     // Call OpenAI API to generate the image
     const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${openaiApiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify(requestBody),
     });
     
     if (!openaiResponse.ok) {
       const errorText = await openaiResponse.text();
       console.error("OpenAI API error:", openaiResponse.status, errorText);
       
       // Set status to failed
       await supabase
         .from("scenes")
         .update({ image_status: "failed" })
         .eq("id", scene_id);
       
       return new Response(
         JSON.stringify({ error: "Failed to generate image", details: errorText }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     const openaiData = await openaiResponse.json();
     console.log("OpenAI response received");
     
     // The response contains base64 encoded image data
     const imageData = openaiData.data[0];
     let imageBytes: Uint8Array;
     
     if (imageData.b64_json) {
       // Decode base64 image
       const binaryString = atob(imageData.b64_json);
       imageBytes = new Uint8Array(binaryString.length);
       for (let i = 0; i < binaryString.length; i++) {
         imageBytes[i] = binaryString.charCodeAt(i);
       }
     } else if (imageData.url) {
       // Download from URL if provided
       const imageResponse = await fetch(imageData.url);
       imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
     } else {
       console.error("No image data in response");
       
       // Set status to failed
       await supabase
         .from("scenes")
         .update({ image_status: "failed" })
         .eq("id", scene_id);
       
       return new Response(
         JSON.stringify({ error: "No image data in OpenAI response" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Upload to character-images bucket at path: {project_id}/scenes/{scene_id}.png
     const filePath = `${scene.project_id}/scenes/${scene_id}.png`;
     
     console.log(`Uploading to character-images/${filePath}`);
     
     const { error: uploadError } = await supabase.storage
       .from("character-images")
       .upload(filePath, imageBytes, {
         contentType: "image/png",
         upsert: true, // Allow overwriting for regeneration
       });
     
     if (uploadError) {
       console.error("Upload error:", uploadError);
       
       // Set status to failed
       await supabase
         .from("scenes")
         .update({ image_status: "failed" })
         .eq("id", scene_id);
       
       return new Response(
         JSON.stringify({ error: "Failed to upload image", details: uploadError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Get public URL
     const { data: publicUrlData } = supabase.storage
       .from("character-images")
       .getPublicUrl(filePath);
     
     // Add cache-busting query param for regeneration
     const imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
     console.log(`Image uploaded: ${imageUrl}`);
     
     // Update scene record with the new image URL and set status to "complete"
     const { error: updateError } = await supabase
       .from("scenes")
       .update({
         image_url: imageUrl,
          image_status: "done",
       })
       .eq("id", scene_id);
     
     if (updateError) {
       console.error("Failed to update scene:", updateError);
       return new Response(
         JSON.stringify({ error: "Failed to update scene", details: updateError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     console.log(`Scene ${scene_id} updated successfully`);
     
     return new Response(
       JSON.stringify({
         success: true,
         image_url: imageUrl,
         scene_id: scene_id,
         reference_images_count: referenceImages.length,
         included_characters: includedCharacters,
         skipped_characters: skippedCharacters,
          included_as_environment: includedAsEnvironment,
          included_as_character_match: includedAsCharacterMatch,
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Unexpected error:", error);
     const errorMessage = error instanceof Error ? error.message : "Unexpected error";
     
     // Set status to failed if we have a scene_id
     if (sceneId) {
       await supabase
         .from("scenes")
         .update({ image_status: "failed" })
         .eq("id", sceneId);
     }
     
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });