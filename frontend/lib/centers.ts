export type CenterKind='online'|'offline';
export type Approval='pending'|'approved'|'rejected';
export type Center={id:number;name:string;kind:CenterKind;city:string;address:string;description:string;logo:string|null;mentor_count:number};
export type CenterFields=Pick<Center,'name'|'kind'|'city'|'address'|'description'>;
export type CenterMember={id:number;full_name:string;approval:Approval;share:number;share_offer:number|null;is_owner:boolean};
export type MyCenter={role:'owner'|'member'|null;center:(CenterFields&{id:number;logo:string|null;approval:Approval;invite_code?:string;earned?:string;members:CenterMember[]})|null};
export const approvalLabel:Record<Approval,string>={pending:'Admin tekshiruvida',approved:'Tasdiqlangan',rejected:'Rad etilgan'};

export const centerInitials=(name:string)=>name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('uz');
