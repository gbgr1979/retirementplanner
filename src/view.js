/** Pure display helpers; no browser state or financial calculation. */
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function discountFactor(plan,months,year,real=true){
 if(!real)return 1;
 const last=months.filter(m=>Number(m.month.slice(0,4))===Number(year)).at(-1)?.month||`${year}-12`;
 const elapsed=(Number(last.slice(0,4))-Number(plan.startMonth.slice(0,4)))*12+Number(last.slice(5))-Number(plan.startMonth.slice(5))+1;
 return Math.pow(1+plan.inflation/100,Math.max(0,elapsed)/12);
}
export function retirementSnapshot(plan,years){
 const person=plan.people.find(p=>p.id==='you');
 const retirementYear=Number(person.retirementMonth.slice(0,4));
 const match=years.find(y=>y.year>=retirementYear);
 return {year:match||years.at(-1),withinHorizon:!!match};
}
