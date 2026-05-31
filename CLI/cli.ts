import {isCancel,select} from  "@clack/prompts"
import chalk from "chalk"
import { runAgentMode } from "../agent/orchestrator"
import { runAskMode } from "../ask/orchestrator"
import { runPlanMode } from "../plan"

export const runCLIMode=async()=>{

    while(true){
            const subMode=await select({
        message:"Choose CLI SubMode",
        options:[
            {value:"Agent",label:"Agent"},
            {value:"Plan",label:"Plan"},
            {value:"Ask",label:"Ask" },
            {value:"Back",label:"Back"}
        ]
    })

    if(subMode=='Agent'){
        await runAgentMode()
    }else if(subMode=='Plan'){
        await runPlanMode()
    }else if(subMode=='Ask'){
        await runAskMode()
    }else if(subMode=='Back'){ 

            return
    }else{
        console.log(chalk.green.bold("GoodBye!!!"))  
        return; 
    }
    }
}
