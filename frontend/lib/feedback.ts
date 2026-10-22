export const FEEDBACK_COMMENT_DELAY_MS=10_000;
export function feedbackSecondsRemaining(deadline:number|null,now:number){
  return deadline===null?10:Math.max(0,Math.ceil((deadline-now)/1000));
}
export function canDismissFeedback(rating:number,deadline:number|null,now:number){
  return rating>=1&&rating<=5&&deadline!==null&&feedbackSecondsRemaining(deadline,now)===0;
}
