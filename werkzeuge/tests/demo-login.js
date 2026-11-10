(async()=>{const set=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
const e=document.querySelector('input[type=email]'),p=document.querySelector('input[type=password]');set(e,'lehrer@demo.fallpfad.de');set(p,'Demo2026');
const b=[...document.querySelectorAll('button')].find(b=>/anmelden/i.test(b.textContent)&&b.type!=='button'||b.type==='submit');(b||p.form.querySelector('button')).click();await new Promise(r=>setTimeout(r,2500));
document.querySelectorAll('.fp-tour, [class*=tour] button').forEach(()=>0);try{window.FP_TOUR&&window.FP_TOUR.stop&&window.FP_TOUR.stop()}catch(e){}
return document.title+' '+(document.querySelector('.topbar')?'in':'out')})()
