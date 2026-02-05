 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
     if (!FAL_API_KEY) {
       throw new Error("FAL_API_KEY is not configured");
     }
 
     const { audio_url } = await req.json();
     
     if (!audio_url) {
       throw new Error("audio_url is required");
     }
 
     console.log("Calling fal.ai Whisper API with audio_url:", audio_url);
 
     const response = await fetch("https://fal.run/fal-ai/whisper", {
       method: "POST",
       headers: {
         "Authorization": `Key ${FAL_API_KEY}`,
         "Content-Type": "application/json",
       },
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