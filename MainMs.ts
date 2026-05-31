import {isCancel,select} from "@clack/prompts"
import chalk from "chalk";

export const modes=async (): Promise<string> =>{
        
    const option=await select({
        message: chalk.green("choose way to communicate"),
        options:[
            {value:"CLI",label:"CLI"},
            {value:"Telegram",label:"Telegram"},
            {value:"Exit",label:"Exit"}
        ]
    })

    if(isCancel(option) || option=="Exit"){
        console.log(chalk.green.bold("Goodbye !!!"))
        return "END";
    }
    if(option=="CLI"){

        // await runCLIMode()
    }else if(option=="Telegram"){
        // await runTeleMode()
    }

    return option
}