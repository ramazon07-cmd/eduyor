import type {CenterKind} from './centers';
export type RankStats={rank:number;rating_average:number;rating_count:number;lessons_completed:number};
export type MentorRank=RankStats&{id:number;full_name:string;avatar:string|null;headline:string;center:{id:number;name:string}|null};
export type CenterRank=RankStats&{id:number;name:string;kind:CenterKind;city:string;logo:string|null;mentor_count:number};
export type Leaderboard={mentors:MentorRank[];centers:CenterRank[]};
