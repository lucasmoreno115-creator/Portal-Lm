const app=document.getElementById('app');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=text??'';return n;};
function appendSection(title,content,cls='card'){const section=el('section','',cls);section.append(el('h2',title));if(content)section.append(content);app.append(section);}
function render(plan){
  app.replaceChildren();
  if(!plan){app.append(el('p','Seu plano alimentar ainda não foi liberado no portal. Assim que estiver disponível, ele aparecerá aqui.','card'));return;}
  const hero=el('section','', 'card');
  hero.append(el('h2',plan.title||'Plano alimentar'),el('p',plan.goal?`Objetivo: ${plan.goal}`:'Objetivo não informado'),el('p',plan.updated_at?`Atualizado em ${new Date(plan.updated_at).toLocaleDateString('pt-BR')}`:'','muted'));
  app.append(hero);
  const meals=el('div','');
  (plan.meals||[]).forEach(meal=>{const mealEl=el('article','', 'meal');mealEl.append(el('h3',meal.name||'Refeição'));if(meal.time)mealEl.append(el('p',meal.time,'muted'));if(meal.guidance)mealEl.append(el('p',meal.guidance));if(meal.primary_text){mealEl.append(el('p',meal.primary_text,'meal-text'));}else{const ul=document.createElement('ul');(meal.items||[]).forEach(item=>ul.append(el('li',`${item.food||''} ${item.quantity||''} ${item.unit||''}${item.note?` — ${item.note}`:''}`.trim())));mealEl.append(ul);}const substitutions=(meal.substitutions||[]).filter(sub=>typeof sub?.text==='string'&&sub.text.trim());if(substitutions.length){const block=el('div','', 'meal-substitutions');block.append(el('strong','Substituições'));substitutions.forEach(sub=>block.append(el('p',sub.text,'meal-text')));mealEl.append(block);}meals.append(mealEl);});
  appendSection('Refeições',meals);
  const observations=el('div','');
  if(plan.notes)observations.append(el('p',plan.notes));
  if(plan.hydration)observations.append(el('p',`Hidratação: ${Array.isArray(plan.hydration)?plan.hydration.join('\n'):plan.hydration}`,'meal-text'));
  if(Array.isArray(plan.supplements)&&plan.supplements.length)observations.append(el('p',`Suplementação: ${plan.supplements.join('\n')}`,'meal-text'));
  appendSection('Observações',observations);
  appendSection('Ferramentas',el('p','Use as substituições e orientações do plano para organizar sua rotina.'));
  const support=el('div','');support.append(el('p',plan.whatsapp_message||'Em caso de dúvida, fale com seu consultor antes de ajustar o plano.'));appendSection('Suporte',support);
  const pdf=el('a','Baixar PDF','card');pdf.href='/portal-plano-alimentar-print.html';app.append(pdf);
}
fetch('/api/portal/premium/nutrition-plan/current').then(r=>r.json()).then(j=>render(j.data)).catch(()=>app.replaceChildren(el('p','Não foi possível carregar o plano agora.','card')));
