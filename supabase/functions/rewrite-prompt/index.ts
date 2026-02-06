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
     const { prompt_type, current_prompt, scene_description, shot_type, feedback } = await req.json();
 
      if (!prompt_type || !feedback) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: prompt_type and feedback are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
 
     const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
     if (!lovableApiKey) {
       throw new Error("LOVABLE_API_KEY not configured");
     }

     // Map shot_type value to human-readable label
     const shotTypeLabels: Record<string, string> = {
       "wide": "Wide Shot",
       "medium": "Medium Shot",
       "close-up": "Close-Up",
       "extreme-close-up": "Extreme Close-Up",
       "two-shot": "Two-Shot",
       "over-shoulder": "Over-the-Shoulder",
     };
     const shotLabel = shot_type ? (shotTypeLabels[shot_type] || shot_type) : null;
 
    const systemPrompt = `You are an expert prompt engineer for AI image and video generation. Your task is to rewrite prompts based on user feedback while maintaining the core scene intent.

CHARACTER RULES:
1. Characters mentioned in the CURRENT PROMPT must be preserved in the rewrite
2. Characters mentioned in the USER FEEDBACK must be ADDED to the rewrite — the user is explicitly requesting them
3. NEVER add characters from the scene_description UNLESS they appear in the current prompt or the user's feedback
4. If unsure, keep existing characters and add any the user mentions

SHOT TYPE RULES:
${shotLabel ? `- The selected shot type is "${shotLabel}". You MUST frame the prompt for this shot type.
- NEVER use a different shot type framing (e.g., do NOT say "Wide shot" if the shot type is "Close-Up").
- End the prompt with "${shotLabel} framing." to reinforce the composition.` : '- No specific shot type is set. Use whatever framing fits the scene.'}

GUIDELINES:
- Keep the same overall scene structure
- Apply the user's feedback to improve the prompt  
- For image prompts: Focus on visual details, composition, lighting, style
- For animation prompts: Focus on motion, camera movement, pacing
- Be concise but descriptive
- Output ONLY the rewritten prompt, no explanations or preamble`;
 
      const hasCurrentPrompt = current_prompt && current_prompt.trim();
      
      const userMessage = hasCurrentPrompt
        ? `Prompt Type: ${prompt_type === 'image' ? 'Image Generation' : 'Animation/Video'}
${shotLabel ? `Selected Shot Type: ${shotLabel}` : ''}

Characters in current prompt must stay. Characters mentioned in user feedback must be added.
 
Scene Description (for context only):
${scene_description}
 
Current Prompt:
${current_prompt}
 
User Feedback:
${feedback}
 
Rewrite the prompt incorporating the feedback. Keep existing characters and add any the user mentions:`
        : `Prompt Type: ${prompt_type === 'image' ? 'Image Generation' : 'Animation/Video'}
${shotLabel ? `Selected Shot Type: ${shotLabel}` : ''}

Write a NEW prompt from scratch based on the scene description and user feedback.

Scene Description:
${scene_description}

User Feedback / Instructions:
${feedback}

Write a complete ${prompt_type === 'image' ? 'image generation' : 'animation/video'} prompt based on the scene description and feedback above:`;
 
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