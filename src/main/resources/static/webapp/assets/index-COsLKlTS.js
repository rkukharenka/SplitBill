(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function a(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(n){if(n.ep)return;n.ep=!0;const o=a(n);fetch(n.href,o)}})();const h="/api/webapp/sessions";function w(){var e,t;return((t=(e=window.Telegram)==null?void 0:e.WebApp)==null?void 0:t.initData)??""}function b(){return{"Content-Type":"application/json","X-Telegram-Init-Data":w()}}async function g(e){if(!e.ok){const t=await e.text();throw new Error(`${e.status}: ${t}`)}return e.json()}async function E(e){const t=await fetch(`${h}/${e}`,{headers:b()});return g(t)}async function I(e,t,a,r){const n=await fetch(`${h}/${e}/items`,{method:"POST",headers:b(),body:JSON.stringify({name:t,price:a,quantity:r})});return g(n)}async function k(e,t){const a=new FormData;a.append("file",t);const r=await fetch(`${h}/${e}/photo`,{method:"POST",headers:{"X-Telegram-Init-Data":w()},body:a});return g(r)}async function q(e,t,a,r){const n=await fetch(`${h}/${e}/items/${t}/assignment`,{method:"PUT",headers:b(),body:JSON.stringify({payerId:a,sharerIds:r})});return g(n)}async function z(e,t){const a=await fetch(`${h}/${e}/participants`,{method:"POST",headers:b(),body:JSON.stringify({name:t})});return g(a)}async function N(e){const t=await fetch(`${h}/${e}/results`,{headers:b()});return g(t)}function M(e){const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100";const a=document.createElement("div");return a.style.cssText="background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0",a.innerHTML=`
    <h3 style="margin-bottom:16px">Добавить позицию</h3>
    <input id="item-name" type="text" placeholder="Название" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="1" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">Добавить</button>
    </div>
  `,t.appendChild(a),t.querySelector("#modal-cancel").addEventListener("click",()=>t.remove()),t.querySelector("#modal-submit").addEventListener("click",()=>{const r=t.querySelector("#item-name").value.trim(),n=parseFloat(t.querySelector("#item-price").value),o=parseInt(t.querySelector("#item-qty").value);if(!r||isNaN(n)||n<=0||isNaN(o)||o<1){alert("Заполните все поля корректно");return}t.remove(),e(r,n,o)}),t}async function C(e,t,a){e.innerHTML='<p style="padding:16px">Загрузка...</p>';let r;try{r=await E(t)}catch(d){e.innerHTML=`<p style="padding:16px;color:red">Ошибка загрузки сессии: ${d.message}</p>`;return}function n(d){const p=d.price*d.quantity;return d.quantity>1?`${d.quantity} × ${d.price} = ${p} ${r.currency}`:`${d.price} ${r.currency}`}function o(d){return r.participants.map(p=>`<option value="${p.id}" ${p.id===d?"selected":""}>${p.displayName}</option>`).join("")}async function i(d){try{const p=await q(t,d.id,d.payerId??r.myParticipantId,d.sharerIds);d.payerId=p.payerId,d.sharerIds=p.sharerIds}catch(p){alert(`Не удалось сохранить: ${p.message}`),y()}}function y(){e.innerHTML=`
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:12px">${r.currency} · ${r.status}</p>
        <div id="roster" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <label style="flex:1">
            <button id="btn-photo" style="width:100%;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">📷 Загрузить чек</button>
            <input id="photo-input" type="file" accept="image/*" style="display:none" />
          </label>
          <button id="btn-add" style="flex:1;padding:10px;border:1px dashed #ccc;border-radius:8px;background:transparent;font-size:14px">+ Позиция</button>
        </div>
        <div id="items-list"></div>
        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--tg-theme-bg-color,#fff);border-top:1px solid #eee;max-width:480px;margin:0 auto">
          <button id="btn-results" style="width:100%;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:15px">Итоги →</button>
        </div>
      </div>
    `;const d=e.querySelector("#roster");r.participants.forEach(s=>{const c=document.createElement("span");c.style.cssText="padding:4px 10px;border-radius:14px;background:#e4e9f0;font-size:13px;font-weight:600;color:#1c1c1c",c.textContent=s.isGuest?`👤 ${s.displayName}`:s.displayName,d.appendChild(c)});const p=document.createElement("button");p.textContent="+ Гость",p.style.cssText="padding:4px 10px;border-radius:14px;border:1px dashed #ccc;background:transparent;font-size:13px",p.addEventListener("click",async()=>{var c;const s=(c=prompt("Имя гостя"))==null?void 0:c.trim();if(s)try{const l=await z(t,s);r.participants.push(l),y()}catch(l){alert(`Ошибка: ${l.message}`)}}),d.appendChild(p);const $=e.querySelector("#items-list");r.items.forEach(s=>{const c=document.createElement("div");c.style.cssText="padding:12px 0;border-bottom:1px solid #f0f0f0",c.innerHTML=`
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:15px;font-weight:600;color:var(--tg-theme-text-color,#1c1c1c)">${s.name}</span>
          <span style="font-size:13px;color:#888">${n(s)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px;color:#888">Платил:</span>
          <select class="payer-select" style="flex:1;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            ${o(s.payerId)}
          </select>
        </div>
        <div class="sharers" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      `;const l=c.querySelector(".payer-select");l.addEventListener("change",()=>{s.payerId=l.value,i(s)});const x=c.querySelector(".sharers"),u=document.createElement("label");u.style.cssText="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:var(--tg-theme-text-color,#1c1c1c)";const S=r.participants.length>0&&r.participants.every(f=>s.sharerIds.includes(f.id));u.innerHTML=`<input type="checkbox" ${S?"checked":""} style="width:16px;height:16px" /> Все`,u.querySelector("input").addEventListener("change",f=>{s.sharerIds=f.target.checked?r.participants.map(m=>m.id):[],i(s),y()}),x.appendChild(u),r.participants.forEach(f=>{const m=document.createElement("label");m.style.cssText="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--tg-theme-text-color,#1c1c1c)";const L=s.sharerIds.includes(f.id);m.innerHTML=`<input type="checkbox" ${L?"checked":""} style="width:16px;height:16px" /> ${f.displayName}`;const v=m.querySelector("input");v.addEventListener("change",()=>{v.checked?s.sharerIds.includes(f.id)||s.sharerIds.push(f.id):s.sharerIds=s.sharerIds.filter(T=>T!==f.id),i(s),y()}),x.appendChild(m)}),$.appendChild(c)}),e.querySelector("#btn-photo").addEventListener("click",()=>{e.querySelector("#photo-input").click()}),e.querySelector("#photo-input").addEventListener("change",async s=>{var x;const c=(x=s.target.files)==null?void 0:x[0];if(!c)return;const l=e.querySelector("#btn-photo");l.textContent="⏳ Распознаю...",l.disabled=!0;try{const u=await k(t,c);r.items.push(...u),y()}catch(u){alert(`Ошибка: ${u.message}`),l.textContent="📷 Загрузить чек",l.disabled=!1}}),e.querySelector("#btn-add").addEventListener("click",()=>{const s=M(async(c,l,x)=>{try{const u=await I(t,c,l,x);r.items.push(u),y()}catch(u){alert(`Ошибка: ${u.message}`)}});document.body.appendChild(s)}),e.querySelector("#btn-results").addEventListener("click",a)}y()}async function O(e,t,a){e.innerHTML='<p style="padding:16px">Считаю...</p>';let r;try{r=await N(t)}catch(i){e.innerHTML=`<p style="padding:16px;color:red">Ошибка: ${i.message}</p>`;return}const n=r.participants.map(i=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${i.displayName}</span>
       <b>${i.totalAmount.toFixed(2)}</b>
     </div>`).join(""),o=r.transfers.length?r.transfers.map(i=>`<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${i.fromName} → ${i.toName}: <b>${i.amount.toFixed(2)}</b>
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
  `,e.querySelector("#btn-back").addEventListener("click",a)}function P(){return new URLSearchParams(window.location.search).get("session")}async function H(){var n,o,i,y;(o=(n=window.Telegram)==null?void 0:n.WebApp)==null||o.ready(),(y=(i=window.Telegram)==null?void 0:i.WebApp)==null||y.expand();const e=document.getElementById("app"),t=P();if(!t){e.innerHTML='<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>';return}function a(){C(e,t,r)}function r(){O(e,t,a)}a()}H().catch(e=>{document.getElementById("app").innerHTML=`<p style="padding:16px;color:red">Ошибка: ${e.message}</p>`});
