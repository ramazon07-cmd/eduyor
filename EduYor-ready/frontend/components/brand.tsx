/** The exact supplied EduYor mark, framed by a native SVG viewBox. */
export function BrandMark({className='',label=''}:{className?:string;label?:string}){
  return <img className={`brand-mark ${className}`} src="/brand/eduyor-mark.svg" alt={label} draggable={false}/>;
}
