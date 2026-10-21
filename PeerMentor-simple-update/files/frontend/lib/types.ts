export type Subject = {id:number;name:string};
export type Profile = {full_name:string;avatar:string|null;school:string;study_level:string;learning_goals:string;timezone:string};
export type MentorSettings = {headline:string;bio:string;subjects:number[];teaching_languages:string;hourly_price:string;is_paused:boolean;approval:'pending'|'approved'|'rejected'};
export type User = {id:number;email:string;profile:Profile;mentor:MentorSettings|null;mentor_listing?:OwnMentorListing|null};
export type Mentor = {id:number;full_name:string;avatar:string|null;school:string;study_level:string;timezone:string;headline:string;bio:string;subjects:Subject[];teaching_languages:string;hourly_price:string};
export type Page<T> = {count:number;next:string|null;previous:string|null;results:T[]};
export type Slot = {starts_at:string;ends_at:string;date:string;time:string};
export type SlotData = {timezone:string;duration_minutes:number;slots:Slot[]};
export type Rule = {weekday:number;start_time:string;end_time:string};
export type Schedule = {rules:Rule[];blocked_dates:string[];timezone:string};
export type Booking = {id:number;student:number;mentor:number;student_name:string;mentor_name:string;starts_at:string;ends_at:string;objective:string;status:string;expires_at:string;total_price:string;platform_fee:string;mentor_net:string;commission_rate:string;currency:string;payment_status:string;payment_reference:string;payout_status:string;meeting_url:string;disputed:boolean;issue_note:string;resolution_note:string;completed_at:string|null};

export type OwnMentorListing = Mentor & {approval:MentorSettings["approval"];is_paused:boolean;is_public:boolean;has_availability:boolean};
export type PaymentInfo = {instructions:string;support:string;card_number:string;card_holder:string;bank_name:string;can_accept_payment:boolean;method:string;verification:string;mentor_payout:string};
