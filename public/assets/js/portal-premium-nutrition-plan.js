const app=document.getElementById('app');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=text??'';return n;};
function appendSection(title,content,cls='card'){const section=el('section','',cls);section.append(el('h2',title));if(content)section.append(content);app.append(section);}function publicText(v){return typeof v==='string'?v:(v?.text||v?.food||v?.name||v?.rule||'')}function appendList(title,values){if(!Array.isArray(values)||!values.length)return;const list=el('div','');values.forEach(v=>{v=publicText(v);if(v)list.append(el('p',v,'meal-text'))});if(list.childNodes.length)appendSection(title,list)}
function render(plan){
  app.replaceChildren();
  if(!plan){app.append(el('p','Seu plano alimentar ainda não foi liberado no portal. Assim que estiver disponível, ele aparecerá aqui.','card'));return;}
  const hero=el('section','', 'card');
  hero.append(el('h2',plan.title||'Plano alimentar'),el('p',plan.goal?`Objetivo: ${plan.goal}`:'Objetivo não informado'));
  if(plan.strategy)hero.append(el('p',`Estratégia: ${plan.strategy}`));
  hero.append(el('p',plan.updated_at?`Atualizado em ${new Date(plan.updated_at).toLocaleDateString('pt-BR')}`:'','muted'));
  app.append(hero);
  const meals=el('div','');
  (plan.meals||[]).forEach(meal=>{const mealEl=el('article','', 'meal');mealEl.append(el('h3',meal.name||'Refeição'));if(meal.time)mealEl.append(el('p',meal.time,'muted'));if(meal.guidance)mealEl.append(el('p',meal.guidance));if(meal.primary_text){mealEl.append(el('p',meal.primary_text,'meal-text'));}else{const ul=document.createElement('ul');(meal.items||[]).forEach(item=>ul.append(el('li',`${item.food||''} ${item.quantity||''} ${item.unit||''}${item.note?` — ${item.note}`:''}`.trim())));mealEl.append(ul);}const substitutions=(meal.substitutions||[]).filter(sub=>typeof sub?.text==='string'&&sub.text.trim());if(substitutions.length){const block=el('div','', 'meal-substitutions');block.append(el('strong','Substituições'));substitutions.forEach(sub=>block.append(el('p',sub.text,'meal-text')));mealEl.append(block);}meals.append(mealEl);});
  appendSection('Refeições',meals);
  appendList('Substituições',plan.substitutions);
  const observations=el('div','');
  if(plan.observations||plan.notes)observations.append(el('p',plan.observations||plan.notes));
  if(plan.hydration)observations.append(el('p',`Hidratação: ${Array.isArray(plan.hydration)?plan.hydration.join('\n'):plan.hydration}`,'meal-text'));
  if(Array.isArray(plan.supplements)&&plan.supplements.length)observations.append(el('p',`Suplementação: ${plan.supplements.join('\n')}`,'meal-text'));
  appendSection('Observações',observations);
  appendList('Regras de adesão',plan.adherence_rules);
  appendSection('Ferramentas',el('p','Use as substituições e orientações do plano para organizar sua rotina.'));
  const support=el('div','');support.append(el('p',plan.whatsapp_message||'Em caso de dúvida, fale com seu consultor antes de ajustar o plano.'));appendSection('Suporte',support);
  const pdf=el('button','Baixar PDF','card');pdf.type='button';pdf.addEventListener('click',()=>window.print());app.append(pdf);
}
api('/portal/premium/nutrition-plan/current').then(j=>render(j.data)).catch(()=>app.replaceChildren(el('p','Não foi possível carregar o plano agora. Tente novamente em instantes.','card')));
