import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

ABSOLUTE CHARACTER RULES (MUST FOLLOW):
1. First, identify ALL character names in the CURRENT PROMPT (names like Webster, Avery, etc.)
2. ONLY those exact characters may appear in your rewritten prompt
3. NEVER add any character from the scene_description that is NOT already in the current_prompt
4. NEVER introduce new characters unless the user's feedback EXPLICITLY says "add [character name]"
5. If a character appears in scene_description but NOT in current_prompt, DO NOT include them
6. If unsure, include FEWER characters, not more

GUIDELINES:
- Keep the same overall scene structure
- Apply the user's feedback to improve the prompt  
- For image prompts: Focus on visual details, composition, lighting, style
- For animation prompts: Focus on motion, camera movement, pacing
- Be concise but descriptive
- Output ONLY the rewritten prompt, no explanations or preamble`;
 
     const userMessage = `Prompt Type: ${prompt_type === 'image' ? 'Image Generation' : 'Animation/Video'}

IMPORTANT: Only characters that appear in "Current Prompt" below may appear in your rewritten version. Do NOT add characters from the scene description.
 
Scene Description (for context only, do NOT pull characters from here):
${scene_description}
 
Current Prompt (ONLY these characters allowed):
${current_prompt}
 
User Feedback:
${feedback}
 
Rewrite the prompt incorporating ONLY the feedback. Do not add any characters not in the current prompt:`;
 
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