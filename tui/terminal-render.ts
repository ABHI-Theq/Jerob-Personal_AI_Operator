import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

let ready=false;

function ensureMarked():void{
    if(ready) return;
    const w=Math.max(40,Math.min(process.stdout.columns || 80,120));
    // @ts-ignore
    marked.use(markedTerminal({width:w,reflowText: true},{}));
    ready=true;
}
export const renderHTMLMarkdown=(content:string): string=>{
    ensureMarked()
    return marked.parse(content.trimEnd(),{async:false}) as string
}