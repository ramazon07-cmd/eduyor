export type Question={prompt:string;options:string[];correct?:number};
export type Submission={id:number;answer:string;answers:number[];answer_checks:boolean[];feedback:string;submitted_at:string;reviewed_at:string|null};
export type Assignment={id:number;mentor:number;student:number;mentor_name:string;student_name:string;title:string;instructions:string;kind:'homework'|'test';deadline:string;questions:Question[];submission:Submission|null};
export function taskState(task:Pick<Assignment,'deadline'> & {submission:{reviewed_at:string|null}|null}){return task.submission?task.submission.reviewed_at?'Tekshirildi':'Tekshiruvda':new Date(task.deadline)<new Date()?'Muddati tugagan':'Topshirish kerak';}

export type AssignmentSummary=Omit<Assignment,'instructions'|'questions'|'submission'> & {submission:Pick<Submission,'id'|'submitted_at'|'reviewed_at'>|null};
export type AssignmentPage={count:number;next:string|null;previous:string|null;results:AssignmentSummary[];summary:{total:number;submitted:number;reviewed:number}};
