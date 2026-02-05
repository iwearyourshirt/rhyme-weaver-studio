 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 const DEFAULT_SYSTEM_MESSAGE = `You are a storyboard director for a stop-motion animated children's show. You create vivid, detailed scene descriptions that will be used to generate images and animate them into video clips.`;
 
 interface TimestampEntry {
   start: number;
   end: number;
   text: string;
 }
 
 interface Character {
   id: string;
   name: string;
   description: string;
   primary_image_url: string | null;
 }
 
interface GeneratedScene {
  scene_number: number;
  start_time: number | string;
  end_time: number | string;
  lyric_snippet: string;
  scene_description: string;
  characters_in_scene: string[];
  shot_type: string;
  image_prompt: string;
  animation_prompt: string;
}

// Helper to parse timestamps that may come as "9.86s" or 9.86
function parseTimestamp(value: number | string): number {
  if (typeof value === "number") return value;
  // Remove "s" suffix and parse
  const cleaned = String(value).replace(/s$/i, "").trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    console.warn(`Invalid timestamp value: ${value}, defaulting to 0`);
    return 0;
  }
  return parsed;
}
 
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Cost logging helper - GPT-4o pricing: $0.0025/1K input, $0.01/1K output
async function logAICost(
  supabaseUrl: string,
  supabaseKey: string,
  projectId: string,
  service: string,
  operation: string,
  cost: number,
  tokensInput?: number,
  tokensOutput?: number
) {
  try {
    // Insert cost log using raw fetch to avoid type issues
    await fetch(`${supabaseUrl}/rest/v1/cost_logs`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        project_id: projectId,
        service,
        operation,
        cost,
        tokens_input: tokensInput || null,
        tokens_output: tokensOutput || null,
      }),
    });

    // Get current total
    const projectResp = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=total_ai_cost`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });
    const projectData = await projectResp.json();
    const currentTotal = Number(projectData?.[0]?.total_ai_cost || 0);

    // Update project total
    await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ total_ai_cost: currentTotal + cost }),
    });

    console.log(`Logged AI cost: ${service} - $${cost.toFixed(4)}`);
  } catch (error) {
    console.error("Failed to log AI cost:", error);
  }
}
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
     if (!OPENAI_API_KEY) {
       console.error("OPENAI_API_KEY is not set");
       return new Response(
         JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
     const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
     
     if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
       console.error("Supabase credentials not configured");
       return new Response(
         JSON.stringify({ error: "Supabase credentials not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 
     const { project_id } = await req.json();
     
     if (!project_id) {
       throw new Error("project_id is required");
     }
 
     console.log("Generating storyboard for project:", project_id);
 
     // Fetch project data
     const { data: project, error: projectError } = await supabase
       .from("projects")
       .select("*")
       .eq("id", project_id)
       .single();
 
     if (projectError || !project) {
       throw new Error(`Failed to fetch project: ${projectError?.message || "Not found"}`);
     }
 
      const timestamps = project.timestamps as TimestampEntry[] | null;
      if (!timestamps || timestamps.length === 0) {
        throw new Error("Project has no timestamps. Please complete project setup first.");
      }

      console.log(`Found ${timestamps.length} timestamp entries`);

      // Build system message with creative direction
      const styleDirection = project.style_direction || "professional animation";
      const creativeBrief = project.creative_brief || "";
      
      let systemMessage = DEFAULT_SYSTEM_MESSAGE;
      if (creativeBrief) {
        systemMessage += ` The visual style for this project is: ${creativeBrief}. Use this to inform scene descriptions, camera angles, and visual details. Do not repeat the style description in every scene — assume it as the default.`;
      } else {
        systemMessage += ` The visual style is: ${styleDirection}.`;
      }

      // Fetch characters
      const { data: characters, error: charsError } = await supabase
        .from("characters")
        .select("id, name, description, primary_image_url")
        .eq("project_id", project_id);

      if (charsError) {
        throw new Error(`Failed to fetch characters: ${charsError.message}`);
      }

      const charList = (characters || []) as Character[];
      console.log(`Found ${charList.length} characters`);

      // Build the user message
      let userMessage = "Here are the characters in this video:\n\n";
      
      if (charList.length === 0) {
        userMessage += "(No characters defined yet)\n\n";
      } else {
        for (const char of charList) {
          userMessage += `- ${char.name}: ${char.description}`;
          if (char.primary_image_url) {
            userMessage += " (reference images exist)";
          }
          userMessage += "\n";
        }
        userMessage += "\n";
      }

      userMessage += "Here are the lyrics with timestamps:\n\n";
      for (const ts of timestamps) {
        userMessage += `[${ts.start.toFixed(2)}s - ${ts.end.toFixed(2)}s]: "${ts.text}"\n`;
      }

       userMessage += `\nGenerate a storyboard with one scene per lyric line. For each scene provide:

- scene_number (integer starting at 1)
- start_time (from the timestamp)
- end_time (from the timestamp)
- lyric_snippet (the text for this timestamp)
- scene_description (2-3 sentences describing what is visually happening in this scene, what the characters are doing, the environment, camera angle, mood)
- characters_in_scene (array of character names that appear in this scene)
- shot_type (one of: "wide", "medium", "close-up", "extreme-close-up", "two-shot", "over-shoulder". Vary these throughout the storyboard to create visual interest. Use wide shots for establishing scenes and environments, close-ups for emotional moments and character focus, medium shots for dialogue and action, etc.)
- image_prompt (a complete image generation prompt that combines the project's visual style with the scene description and character descriptions. Include the shot type framing in the prompt. This should be detailed enough to generate the image standalone without any other context.)
- animation_prompt (a short description of how this scene should be animated: what moves, camera motion, character actions. Keep it to 1-2 sentences focused on the key motion.)

Return the result as a JSON object with a single key "scenes" containing an array of scene objects.`;
 
      console.log("Calling OpenAI API...");
      console.log("System message:", systemMessage);
      console.log("User message:", userMessage);

      const openaiPayload = {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
      };
 
     const response = await fetch("https://api.openai.com/v1/chat/completions", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${OPENAI_API_KEY}`,
       },
       body: JSON.stringify(openaiPayload),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error("OpenAI API error:", response.status, errorText);
       throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
     }
 
      const data: OpenAIResponse = await response.json();
      console.log("OpenAI response received");

      // Log AI cost - GPT-4o: $0.0025/1K input, $0.01/1K output
      if (data.usage) {
        const inputCost = (data.usage.prompt_tokens / 1000) * 0.0025;
        const outputCost = (data.usage.completion_tokens / 1000) * 0.01;
        const totalCost = inputCost + outputCost;
        
        await logAICost(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          project_id,
          "openai-gpt4o",
          "Storyboard generation",
          totalCost,
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        );
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      console.log("Parsing OpenAI response...");
      const parsed = JSON.parse(content);
      const generatedScenes: GeneratedScene[] = parsed.scenes;

      if (!generatedScenes || !Array.isArray(generatedScenes)) {
        throw new Error("Invalid response format: expected scenes array");
      }

      console.log(`Parsed ${generatedScenes.length} scenes`);
 
     // Delete existing scenes for this project
     const { error: deleteError } = await supabase
       .from("scenes")
       .delete()
       .eq("project_id", project_id);
 
     if (deleteError) {
       console.error("Error deleting existing scenes:", deleteError);
     }
 
      // Insert new scenes - parse timestamps to handle "9.86s" format
      const scenesToInsert = generatedScenes.map((scene) => ({
        project_id,
        scene_number: scene.scene_number,
        start_time: parseTimestamp(scene.start_time),
        end_time: parseTimestamp(scene.end_time),
        lyric_snippet: scene.lyric_snippet,
        scene_description: scene.scene_description,
        characters_in_scene: scene.characters_in_scene,
        shot_type: scene.shot_type || 'medium',
        image_prompt: scene.image_prompt,
        animation_prompt: scene.animation_prompt,
        image_url: null,
        image_status: "pending",
        video_url: null,
        video_status: "pending",
      }));
 
     const { data: insertedScenes, error: insertError } = await supabase
       .from("scenes")
       .insert(scenesToInsert)
       .select();
 
     if (insertError) {
       throw new Error(`Failed to insert scenes: ${insertError.message}`);
     }
 
     console.log(`Inserted ${insertedScenes?.length || 0} scenes`);
 
     // Update project status
     const { error: updateError } = await supabase
       .from("projects")
       .update({ status: "storyboard" })
       .eq("id", project_id);
 
     if (updateError) {
       console.error("Error updating project status:", updateError);
     }
 
     return new Response(
       JSON.stringify({
         scenes: insertedScenes,
         prompt: {
           system: systemMessage,
           user: userMessage,
         },
         raw_response: content,
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Storyboard generation error:", error);
     const errorMessage = error instanceof Error ? error.message : "Unknown error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });