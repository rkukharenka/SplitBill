(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const p of s.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&r(p)}).observe(document,{childList:!0,subtree:!0});function a(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(n){if(n.ep)return;n.ep=!0;const s=a(n);fetch(n.href,s)}})();const f="/api/webapp/sessions";function $(){var e,t;return((t=(e=window.Telegram)==null?void 0:e.WebApp)==null?void 0:t.initData)??""}function b(){return{"Content-Type":"application/json","X-Telegram-Init-Data":$()}}async function m(e){if(!e.ok){const t=await e.text();throw new Error(`${e.status}: ${t}`)}return e.json()}async function q(e){const t=await fetch(`${f}/${e}`,{headers:b()});return m(t)}async function E(e,t,a,r){const n=await fetch(`${f}/${e}/items`,{method:"POST",headers:b(),body:JSON.stringify({name:t,price:a,quantity:r})});return m(n)}async function I(e,t){const a=new FormData;a.append("file",t);const r=await fetch(`${f}/${e}/photo`,{method:"POST",headers:{"X-Telegram-Init-Data":$()},body:a});return m(r)}async function k(e,t,a,r){const n=await fetch(`${f}/${e}/items/${t}/assignment`,{method:"PUT",headers:b(),body:JSON.stringify({payerId:a,sharerIds:r})});return m(n)}async function z(e,t){const a=await fetch(`${f}/${e}/participants`,{method:"POST",headers:b(),body:JSON.stringify({name:t})});return m(a)}async function N(e){const t=await fetch(`${f}/${e}/results`,{headers:b()});return m(t)}function M(e){const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100";const a=document.createElement("div");return a.style.cssText="background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0",a.innerHTML=`
    <h3 style="margin-bottom:16px">Добавить позицию</h3>
    <input id="item-name" type="text" placeholder="Название" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="1" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">Добавить</button>
    </div>
  `,t.appendChild(a),t.querySelector("#modal-cancel").addEventListener("click",()=>t.remove()),t.querySelector("#modal-submit").addEventListener("click",()=>{const r=t.querySelector("#item-name").value.trim(),n=parseFloat(t.querySelector("#item-price").value),s=parseInt(t.querySelector("#item-qty").value);if(!r||isNaN(n)||n<=0||isNaN(s)||s<1){alert("Заполните все поля корректно");return}t.remove(),e(r,n,s)}),t}async function v(e,t,a){e.innerHTML='<p style="padding:16px">Загрузка...</p>';let r;try{r=await q(t)}catch(i){e.innerHTML=`<p style="padding:16px;color:red">Ошибка загрузки сессии: ${i.message}</p>`;return}function n(i){const c=i.price*i.quantity;return i.quantity>1?`${i.quantity} × ${i.price} = ${c} ${r.currency}`:`${i.price} ${r.currency}`}function s(i){return r.participants.map(c=>`<option value="${c.id}" ${c.id===i?"selected":""}>${c.displayName}</option>`).join("")}async function p(i){try{const c=await k(t,i.id,i.payerId??r.myParticipantId,i.sharerIds);i.payerId=c.payerId,i.sharerIds=c.sharerIds}catch(c){alert(`Не удалось сохранить: ${c.message}`),x()}}function x(){e.innerHTML=`
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
    `;const i=e.querySelector("#roster");r.participants.forEach(o=>{const d=document.createElement("span");d.style.cssText="padding:4px 10px;border-radius:14px;background:#f0f0f0;font-size:13px",d.textContent=o.isGuest?`👤 ${o.displayName}`:o.displayName,i.appendChild(d)});const c=document.createElement("button");c.textContent="+ Гость",c.style.cssText="padding:4px 10px;border-radius:14px;border:1px dashed #ccc;background:transparent;font-size:13px",c.addEventListener("click",async()=>{var d;const o=(d=prompt("Имя гостя"))==null?void 0:d.trim();if(o)try{const l=await z(t,o);r.participants.push(l),x()}catch(l){alert(`Ошибка: ${l.message}`)}}),i.appendChild(c);const S=e.querySelector("#items-list");r.items.forEach(o=>{const d=document.createElement("div");d.style.cssText="padding:12px 0;border-bottom:1px solid #f0f0f0",d.innerHTML=`
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:15px">${o.name}</span>
          <span style="font-size:13px;color:#888">${n(o)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px;color:#888">Платил:</span>
          <select class="payer-select" style="flex:1;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            ${s(o.payerId)}
          </select>
        </div>
        <div class="sharers" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      `;const l=d.querySelector(".payer-select");l.addEventListener("change",()=>{o.payerId=l.value,p(o)});const y=d.querySelector(".sharers");r.participants.forEach(u=>{const g=document.createElement("label");g.style.cssText="display:flex;align-items:center;gap:4px;font-size:13px";const L=o.sharerIds.includes(u.id);g.innerHTML=`<input type="checkbox" ${L?"checked":""} style="width:16px;height:16px" /> ${u.displayName}`;const h=g.querySelector("input");h.addEventListener("change",()=>{h.checked?o.sharerIds.includes(u.id)||o.sharerIds.push(u.id):o.sharerIds=o.sharerIds.filter(T=>T!==u.id),p(o)}),y.appendChild(g)}),S.appendChild(d)}),e.querySelector("#btn-photo").addEventListener("click",()=>{e.querySelector("#photo-input").click()}),e.querySelector("#photo-input").addEventListener("change",async o=>{var y;const d=(y=o.target.files)==null?void 0:y[0];if(!d)return;const l=e.querySelector("#btn-photo");l.textContent="⏳ Распознаю...",l.disabled=!0;try{const u=await I(t,d);r.items.push(...u),x()}catch(u){alert(`Ошибка: ${u.message}`),l.textContent="📷 Загрузить чек",l.disabled=!1}}),e.querySelector("#btn-add").addEventListener("click",()=>{const o=M(async(d,l,y)=>{try{const u=await E(t,d,l,y);r.items.push(u),x()}catch(u){alert(`Ошибка: ${u.message}`)}});document.body.appendChild(o)}),e.querySelector("#btn-results").addEventListener("click",a)}x()}async function w(e,t,a){e.innerHTML='<p style="padding:16px">Считаю...</p>';let r;try{r=await N(t)}catch(p){e.innerHTML=`<p style="padding:16px;color:red">Ошибка: ${p.message}</p>`;return}const n=r.participants.map(p=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${p.displayName}</span>
       <b>${p.totalAmount.toFixed(2)}</b>
     </div>`).join(""),s=r.transfers.length?r.transfers.map(p=>`<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${p.fromName} → ${p.toName}: <b>${p.amount.toFixed(2)}</b>
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
        ${s}
      </section>
    </div>
  `,e.querySelector("#btn-back").addEventListener("click",a)}function O(){return new URLSearchParams(window.location.search).get("session")}async function P(){var a,r,n,s;(r=(a=window.Telegram)==null?void 0:a.WebApp)==null||r.ready(),(s=(n=window.Telegram)==null?void 0:n.WebApp)==null||s.expand();const e=document.getElementById("app"),t=O();if(!t){e.innerHTML='<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>';return}await v(e,t,()=>{w(e,t,()=>{v(e,t,()=>{w(e,t,()=>{})})})})}P().catch(e=>{document.getElementById("app").innerHTML=`<p style="padding:16px;color:red">Ошибка: ${e.message}</p>`});
