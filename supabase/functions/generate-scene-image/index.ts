 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
   
   try {
     const { scene_id, project_id } = await req.json();
     
     if (!scene_id || !project_id) {
       return new Response(
         JSON.stringify({ error: "scene_id and project_id are required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     console.log(`Generating scene image for scene ${scene_id} in project ${project_id}`);
     
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
     
     if (!openaiApiKey) {
       console.error("OPENAI_API_KEY is not configured");
       return new Response(
         JSON.stringify({ error: "OpenAI API key not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
     
     // Fetch the scene to get the image prompt
     const { data: scene, error: sceneError } = await supabase
       .from("scenes")
       .select("image_prompt")
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
     
     // Call OpenAI API to generate the image
     const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${openaiApiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "gpt-image-1",
         prompt: scene.image_prompt,
         size: "1536x1024", // 3:2 landscape aspect ratio
         quality: "medium",
         n: 1,
       }),
     });
     
     if (!openaiResponse.ok) {
       const errorText = await openaiResponse.text();
       console.error("OpenAI API error:", openaiResponse.status, errorText);
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
       return new Response(
         JSON.stringify({ error: "No image data in OpenAI response" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Upload to scene-images bucket
     const timestamp = Date.now();
     const filePath = `${project_id}/${scene_id}/${timestamp}.png`;
     
     console.log(`Uploading to scene-images/${filePath}`);
     
     const { error: uploadError } = await supabase.storage
       .from("scene-images")
       .upload(filePath, imageBytes, {
         contentType: "image/png",
         upsert: false,
       });
     
     if (uploadError) {
       console.error("Upload error:", uploadError);
       return new Response(
         JSON.stringify({ error: "Failed to upload image", details: uploadError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
     
     // Get public URL
     const { data: publicUrlData } = supabase.storage
       .from("scene-images")
       .getPublicUrl(filePath);
     
     const imageUrl = publicUrlData.publicUrl;
     console.log(`Image uploaded: ${imageUrl}`);
     
     // Update scene record with the new image URL and status
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
         scene_id,
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Unexpected error:", error);
     const errorMessage = error instanceof Error ? error.message : "Unexpected error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });