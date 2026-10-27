export type FamilyInvite={id:number;code:string};
export type FamilyChild={link:number;id:number;full_name:string;avatar:string|null;study_level:string};
export type Family={invite:FamilyInvite|null;children:FamilyChild[];parents:{link:number;full_name:string;linked_at:string}[]};
export type ChildLesson={id:number;mentor_name:string;starts_at:string;ends_at:string;status:string;objective:string;total_price:string};
export type ChildTask={id:number;title:string;kind:'homework'|'test';mentor_name:string;deadline:string;question_count:number;submission:{submitted_at:string;reviewed_at:string|null;feedback:string;correct_answers:number|null}|null};
export type ChildProgress={child:{id:number;full_name:string;avatar:string|null;study_level:string;learning_goals:string};lessons:{completed:number;upcoming:number;awaiting_payment:number};upcoming:ChildLesson[];recent:ChildLesson[];tasks:{total:number;submitted:number;reviewed:number};assignments:ChildTask[]};