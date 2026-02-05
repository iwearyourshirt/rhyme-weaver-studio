 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface WhisperChunk {
   text: string;
   timestamp: [number, number];
 }
 
 interface WhisperResponse {
   text: string;
   chunks: WhisperChunk[];
 }
 
 interface TimestampEntry {
   start: number;
   end: number;
   text: string;
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

     const { audio_url } = await req.json();
     
     if (!audio_url) {
       throw new Error("audio_url is required");
     }
 
     console.log("Calling fal.ai Whisper API with audio_url:", audio_url);
 
    const requestHeaders = new Headers({
      "Content-Type": "application/json",
      "Authorization": `Key ${cleanApiKey}`,
    });

     const response = await fetch("https://fal.run/fal-ai/whisper", {
       method: "POST",
      headers: requestHeaders,
       body: JSON.stringify({
         audio_url,
         task: "transcribe",
         chunk_level: "segment",
         version: "3",
       }),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error("fal.ai Whisper error:", response.status, errorText);
       throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
     }
 
     const data: WhisperResponse = await response.json();
     console.log("Whisper response received, chunks:", data.chunks?.length);
 
     // Transform chunks into our timestamp format
     const timestamps: TimestampEntry[] = (data.chunks || []).map((chunk) => ({
       start: chunk.timestamp[0],
       end: chunk.timestamp[1],
       text: chunk.text.trim(),
     }));
 
     return new Response(
       JSON.stringify({
         text: data.text,
         timestamps,
       }),
       {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   } catch (error) {
     console.error("Transcription error:", error);
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