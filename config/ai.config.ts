import { createGroq } from "@ai-sdk/groq"
import {createOpenRouter} from "@openrouter/ai-sdk-provider"
export const getAgentModel=()=>{
    const provider=createOpenRouter({
    apiKey:process.env.OPENROUTER_KEY
})
const modelId=process.env.OPENROUTER_MODEL


    return provider(modelId!)
}
export const getAgentModel2=()=>{
    const provider=createGroq({
        apiKey:process.env.GROQ_API_KEY
    })
    // Try llama3-70b-8192 which is more reliable for structured output
    return provider("llama-3.3-70b-versatile")
}

export const getAgentModel2Fallback=()=>{
    const provider=createOpenRouter({
    apiKey:process.env.OPENROUTER_KEY
})
    // Fallback to OpenRouter if Groq refuses
    return provider("openrouter/free")
}
