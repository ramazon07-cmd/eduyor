const storageKey='eduyor.sidebar-collapsed';

// Runs in <head> before hydration so a collapsed rail never flashes open on reload.
export const sidebarInitScript=`try{if(localStorage.getItem('${storageKey}')==='1')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`;

export function sidebarCollapsedSnapshot(){return document.documentElement.dataset.sidebar==='collapsed';}

export function setSidebarCollapsed(collapsed:boolean){
  if(collapsed)document.documentElement.dataset.sidebar='collapsed';else delete document.documentElement.dataset.sidebar;
  try{localStorage.setItem(storageKey,collapsed?'1':'0');}catch{}
}
