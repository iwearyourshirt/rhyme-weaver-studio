 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { prompt_type, current_prompt, scene_description, feedback } = await req.json();
 
     if (!prompt_type || !current_prompt || !feedback) {
       return new Response(
         JSON.stringify({ error: "Missing required fields" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
     if (!lovableApiKey) {
       throw new Error("LOVABLE_API_KEY not configured");
     }
 
     const systemPrompt = `You are an expert prompt engineer for AI image and video generation. Your task is to rewrite prompts based on user feedback while maintaining the core scene intent.
 
 Guidelines:
 - Keep the same overall scene structure and characters
 - Apply the user's feedback to improve the prompt
 - For image prompts: Focus on visual details, composition, lighting, style
 - For animation prompts: Focus on motion, camera movement, pacing
 - Be concise but descriptive
 - Output ONLY the rewritten prompt, no explanations`;
 
     const userMessage = `Prompt Type: ${prompt_type === 'image' ? 'Image Generation' : 'Animation/Video'}
 
 Scene Description: ${scene_description}
 
 Current Prompt:
 ${current_prompt}
 
 User Feedback:
 ${feedback}
 
 Rewrite the prompt incorporating the feedback:`;
 
     console.log(`Rewriting ${prompt_type} prompt with feedback: ${feedback}`);
 
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${lovableApiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-3-flash-preview",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: userMessage },
         ],
         temperature: 0.7,
         max_tokens: 500,
       }),
     });
 
     if (!response.ok) {
       const error = await response.text();
       console.error("AI Gateway error:", error);
       throw new Error("Failed to get AI response");
     }
 
     const data = await response.json();
     const rewrittenPrompt = data.choices?.[0]?.message?.content?.trim();
 
     if (!rewrittenPrompt) {
       throw new Error("No response from AI");
     }
 
     console.log("Rewritten prompt:", rewrittenPrompt.substring(0, 100) + "...");
 
     return new Response(
       JSON.stringify({ rewritten_prompt: rewrittenPrompt }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Error:", error);
     const errorMessage = error instanceof Error ? error.message : "Failed to rewrite prompt";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });