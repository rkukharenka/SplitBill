(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&r(d)}).observe(document,{childList:!0,subtree:!0});function i(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(n){if(n.ep)return;n.ep=!0;const o=i(n);fetch(n.href,o)}})();const m="/api/webapp/sessions";function h(){var e,t;return((t=(e=window.Telegram)==null?void 0:e.WebApp)==null?void 0:t.initData)??""}function y(){return{"Content-Type":"application/json","X-Telegram-Init-Data":h()}}async function f(e){if(!e.ok){const t=await e.text();throw new Error(`${e.status}: ${t}`)}return e.json()}async function v(e){const t=await fetch(`${m}/${e}`,{headers:y()});return f(t)}async function $(e,t,i,r){const n=await fetch(`${m}/${e}/items`,{method:"POST",headers:y(),body:JSON.stringify({name:t,price:i,quantity:r})});return f(n)}async function w(e,t){const i=new FormData;i.append("file",t);const r=await fetch(`${m}/${e}/photo`,{method:"POST",headers:{"X-Telegram-Init-Data":h()},body:i});return f(r)}async function S(e,t){const i=await fetch(`${m}/${e}/claims`,{method:"PUT",headers:y(),body:JSON.stringify({itemIds:t})});return f(i)}async function L(e){const t=await fetch(`${m}/${e}/results`,{headers:y()});return f(t)}function k(e){const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100";const i=document.createElement("div");return i.style.cssText="background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0",i.innerHTML=`
    <h3 style="margin-bottom:16px">Добавить позицию</h3>
    <input id="item-name" type="text" placeholder="Название" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="1" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">Добавить</button>
    </div>
  `,t.appendChild(i),t.querySelector("#modal-cancel").addEventListener("click",()=>t.remove()),t.querySelector("#modal-submit").addEventListener("click",()=>{const r=t.querySelector("#item-name").value.trim(),n=parseFloat(t.querySelector("#item-price").value),o=parseInt(t.querySelector("#item-qty").value);if(!r||isNaN(n)||n<=0||isNaN(o)||o<1){alert("Заполните все поля корректно");return}t.remove(),e(r,n,o)}),t}async function x(e,t,i){e.innerHTML='<p style="padding:16px">Загрузка...</p>';let r;try{r=await v(t)}catch(a){e.innerHTML=`<p style="padding:16px;color:red">Ошибка загрузки сессии: ${a.message}</p>`;return}const n=new Set(r.myClaimedItemIds);function o(a){const s=a.price*a.quantity;return a.quantity>1?`${a.quantity} × ${a.price} = ${s} ${r.currency}`:`${a.price} ${r.currency}`}function d(){return r.items.filter(a=>n.has(a.id)).reduce((a,s)=>a+s.price*s.quantity,0)}function b(){e.innerHTML=`
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:16px">${r.currency} · ${r.status}</p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>Мои позиции: <b>${d().toFixed(2)} ${r.currency}</b></span>
            <button id="btn-results" style="padding:10px 16px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:14px">Итоги →</button>
          </div>
        </div>
      </div>
    `;const a=e.querySelector("#items-list");r.items.forEach(s=>{const p=document.createElement("div");p.style.cssText="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0";const l=n.has(s.id);p.innerHTML=`
        <input type="checkbox" id="item-${s.id}" ${l?"checked":""} style="width:20px;height:20px;margin-right:12px;flex-shrink:0" />
        <label for="item-${s.id}" style="flex:1;cursor:pointer">
          <div style="font-size:15px">${s.name}</div>
          <div style="font-size:13px;color:#888">${o(s)}</div>
        </label>
      `;const c=p.querySelector("input");c.addEventListener("change",async()=>{c.checked?n.add(s.id):n.delete(s.id),e.querySelector("b").textContent=`${d().toFixed(2)} ${r.currency}`;try{await S(t,Array.from(n))}catch{c.checked=!c.checked,c.checked?n.add(s.id):n.delete(s.id)}}),a.appendChild(p)}),e.querySelector("#btn-photo").addEventListener("click",()=>{e.querySelector("#photo-input").click()}),e.querySelector("#photo-input").addEventListener("change",async s=>{var c;const p=(c=s.target.files)==null?void 0:c[0];if(!p)return;const l=e.querySelector("#btn-photo");l.textContent="⏳ Распознаю...",l.disabled=!0;try{const u=await w(t,p);r.items.push(...u),b()}catch(u){alert(`Ошибка: ${u.message}`),l.textContent="📷 Загрузить чек",l.disabled=!1}}),e.querySelector("#btn-add").addEventListener("click",()=>{const s=k(async(p,l,c)=>{try{const u=await $(t,p,l,c);r.items.push(u),b()}catch(u){alert(`Ошибка: ${u.message}`)}});document.body.appendChild(s)}),e.querySelector("#btn-results").addEventListener("click",i)}b()}async function g(e,t,i){e.innerHTML='<p style="padding:16px">Считаю...</p>';let r;try{r=await L(t)}catch(d){e.innerHTML=`<p style="padding:16px;color:red">Ошибка: ${d.message}</p>`;return}const n=r.participants.map(d=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${d.displayName}</span>
       <b>${d.totalAmount.toFixed(2)}</b>
     </div>`).join(""),o=r.transfers.length?r.transfers.map(d=>`<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${d.fromName} → ${d.toName}: <b>${d.amount.toFixed(2)}</b>
         </div>`).join(""):'<p style="color:#888;padding:8px 0">Все в расчёте 🎉</p>';e.innerHTML=`
    <div>
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <button id="btn-back" style="border:none;background:none;font-size:22px;padding:0 8px 0 0;cursor:pointer">←</button>
        <h2>Итоги</h2>
      </div>
      <section style="margin-bottom:24px">
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Суммы участников</h3>
        ${n}
      </section>
      <section>
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Переводы</h3>
        ${o}
      </section>
    </div>
  `,e.querySelector("#btn-back").addEventListener("click",i)}function q(){return new URLSearchParams(window.location.search).get("session")}async function T(){var i,r,n,o;(r=(i=window.Telegram)==null?void 0:i.WebApp)==null||r.ready(),(o=(n=window.Telegram)==null?void 0:n.WebApp)==null||o.expand();const e=document.getElementById("app"),t=q();if(!t){e.innerHTML='<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>';return}await x(e,t,()=>{g(e,t,()=>{x(e,t,()=>{g(e,t,()=>{})})})})}T().catch(e=>{document.getElementById("app").innerHTML=`<p style="padding:16px;color:red">Ошибка: ${e.message}</p>`});
