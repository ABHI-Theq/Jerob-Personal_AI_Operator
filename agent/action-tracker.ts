import type {ActionLog,ActionStatus} from "./types";
import  {isMutationType} from  "./types";
export class ActionTracker{

    private actions:ActionLog[]=[];



    log(
        entry: Omit<ActionLog,'id'|'timestamp'> & {
            'id'?:string,
            'timestamp'?:Date
        }
    ):ActionLog {

        const action={
            id:entry.id ?? `action_${this.actions.length}`,
            timestamp:entry.timestamp ?? new Date(),
            type:entry.type,
            path:entry.path,
            details:{...entry.details},
            status:entry.status,
            userApproved:entry.userApproved,
                };

                this.actions.push(action)

                return action
    }

    getActions(): readonly ActionLog[]{
        return this.actions
    }

    getPendingMutations(): ActionLog[]{
        return this.actions.filter((e)=>isMutationType(e.type) && e.status === 'pending')
    }

    updateStatus(id: string,status: ActionStatus,userApproved?:boolean){
        const ac=this.actions.find((e)=>e.id==id)
        if(!ac) return;
        ac.status=status
        if(userApproved!==undefined) ac.userApproved=userApproved
    }
}