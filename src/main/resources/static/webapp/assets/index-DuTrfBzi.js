(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function r(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(s){if(s.ep)return;s.ep=!0;const o=r(s);fetch(s.href,o)}})();const x="/api/webapp/sessions";function S(){var e,t;return((t=(e=window.Telegram)==null?void 0:e.WebApp)==null?void 0:t.initData)??""}function g(){return{"Content-Type":"application/json","X-Telegram-Init-Data":S()}}async function v(e){if(!e.ok){const t=await e.text();throw new Error(`${e.status}: ${t}`)}return e.json()}async function T(e){const t=await fetch(`${x}/${e}`,{headers:g()});return v(t)}async function k(e,t,r,n){const s=await fetch(`${x}/${e}/items`,{method:"POST",headers:g(),body:JSON.stringify({name:t,price:r,quantity:n})});return v(s)}async function I(e,t,r,n,s){const o=await fetch(`${x}/${e}/items/${t}`,{method:"PUT",headers:g(),body:JSON.stringify({name:r,price:n,quantity:s})});return v(o)}async function z(e,t){const r=await fetch(`${x}/${e}/items/${t}`,{method:"DELETE",headers:g()});if(!r.ok){const n=await r.text();throw new Error(`${r.status}: ${n}`)}}async function N(e,t){const r=new FormData;r.append("file",t);const n=await fetch(`${x}/${e}/photo`,{method:"POST",headers:{"X-Telegram-Init-Data":S()},body:r});return v(n)}async function C(e,t,r,n){const s=await fetch(`${x}/${e}/items/${t}/assignment`,{method:"PUT",headers:g(),body:JSON.stringify({payerId:r,sharerIds:n})});return v(s)}async function M(e,t){const r=await fetch(`${x}/${e}/participants`,{method:"POST",headers:g(),body:JSON.stringify({name:t})});return v(r)}async function O(e){const t=await fetch(`${x}/${e}/results`,{headers:g()});return v(t)}function L(e,t={}){const r=document.createElement("div");r.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;z-index:100";const n=document.createElement("div");return n.style.cssText="background:var(--tg-theme-bg-color,#fff);width:100%;padding:20px;border-radius:16px 16px 0 0",n.innerHTML=`
    <h3 style="margin-bottom:16px">${t.title??"Добавить позицию"}</h3>
    <input id="item-name" type="text" placeholder="Название" value="${t.name??""}" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-price" type="number" step="0.01" min="0.01" placeholder="Цена" value="${t.price??""}" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <input id="item-qty" type="number" min="1" value="${t.quantity??1}" placeholder="Количество" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #ccc;border-radius:8px;font-size:16px" />
    <div style="display:flex;gap:8px">
      <button id="modal-cancel" style="flex:1;padding:12px;border:none;border-radius:8px;background:#eee;font-size:16px">Отмена</button>
      <button id="modal-submit" style="flex:1;padding:12px;border:none;border-radius:8px;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);font-size:16px">${t.submitLabel??"Добавить"}</button>
    </div>
  `,r.appendChild(n),r.querySelector("#modal-cancel").addEventListener("click",()=>r.remove()),r.querySelector("#modal-submit").addEventListener("click",()=>{const s=r.querySelector("#item-name").value.trim(),o=parseFloat(r.querySelector("#item-price").value),i=parseInt(r.querySelector("#item-qty").value);if(!s||isNaN(o)||o<=0||isNaN(i)||i<1){alert("Заполните все поля корректно");return}r.remove(),e(s,o,i)}),r}async function P(e,t,r){e.innerHTML='<p style="padding:16px">Загрузка...</p>';let n;try{n=await T(t)}catch(d){e.innerHTML=`<p style="padding:16px;color:red">Ошибка загрузки сессии: ${d.message}</p>`;return}function s(d){const p=d.price*d.quantity;return d.quantity>1?`${d.quantity} × ${d.price} = ${p} ${n.currency}`:`${d.price} ${n.currency}`}function o(d){return n.participants.map(p=>`<option value="${p.id}" ${p.id===d?"selected":""}>${p.displayName}</option>`).join("")}async function i(d){try{const p=await C(t,d.id,d.payerId??n.myParticipantId,d.sharerIds);d.payerId=p.payerId,d.sharerIds=p.sharerIds}catch(p){alert(`Не удалось сохранить: ${p.message}`),y()}}function y(){e.innerHTML=`
      <div style="padding-bottom:80px">
        <h2 style="margin-bottom:4px">Счёт</h2>
        <p style="color:#888;margin-bottom:12px">${n.currency} · ${n.status}</p>
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
    `;const d=e.querySelector("#roster");n.participants.forEach(a=>{const c=document.createElement("span");c.style.cssText="padding:4px 10px;border-radius:14px;background:#e4e9f0;font-size:13px;font-weight:600;color:#1c1c1c",c.textContent=a.isGuest?`👤 ${a.displayName}`:a.displayName,d.appendChild(c)});const p=document.createElement("button");p.textContent="+ Гость",p.style.cssText="padding:4px 10px;border-radius:14px;border:1px dashed #ccc;background:transparent;font-size:13px",p.addEventListener("click",async()=>{var c;const a=(c=prompt("Имя гостя"))==null?void 0:c.trim();if(a)try{const u=await M(t,a);n.participants.push(u),y()}catch(u){alert(`Ошибка: ${u.message}`)}}),d.appendChild(p);const q=e.querySelector("#items-list");n.items.forEach(a=>{const c=document.createElement("div");c.style.cssText="padding:12px 0;border-bottom:1px solid #f0f0f0",c.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:15px;font-weight:600;color:var(--tg-theme-text-color,#1c1c1c)">${a.name}</span>
          <span style="display:flex;align-items:center;gap:10px">
            <span style="font-size:13px;color:#888">${s(a)}</span>
            <button class="edit-btn" style="border:none;background:none;font-size:16px;padding:2px;cursor:pointer">✏️</button>
            <button class="del-btn" style="border:none;background:none;font-size:16px;padding:2px;cursor:pointer">🗑</button>
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:12px;color:#888">Платил:</span>
          <select class="payer-select" style="flex:1;padding:4px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            ${o(a.payerId)}
          </select>
        </div>
        <div class="sharers" style="display:flex;flex-wrap:wrap;gap:8px"></div>
      `;const u=c.querySelector(".payer-select");u.addEventListener("change",()=>{a.payerId=u.value,i(a)});const b=c.querySelector(".sharers"),f=document.createElement("label");f.style.cssText="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:var(--tg-theme-text-color,#1c1c1c)";const E=n.participants.length>0&&n.participants.every(l=>a.sharerIds.includes(l.id));f.innerHTML=`<input type="checkbox" ${E?"checked":""} style="width:16px;height:16px" /> Все`,f.querySelector("input").addEventListener("change",l=>{a.sharerIds=l.target.checked?n.participants.map(m=>m.id):[],i(a),y()}),b.appendChild(f),n.participants.forEach(l=>{const m=document.createElement("label");m.style.cssText="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--tg-theme-text-color,#1c1c1c)";const w=a.sharerIds.includes(l.id);m.innerHTML=`<input type="checkbox" ${w?"checked":""} style="width:16px;height:16px" /> ${l.displayName}`;const $=m.querySelector("input");$.addEventListener("change",()=>{$.checked?a.sharerIds.includes(l.id)||a.sharerIds.push(l.id):a.sharerIds=a.sharerIds.filter(h=>h!==l.id),i(a),y()}),b.appendChild(m)}),c.querySelector(".edit-btn").addEventListener("click",()=>{const l=L(async(m,w,$)=>{try{const h=await I(t,a.id,m,w,$);a.name=h.name,a.price=h.price,a.quantity=h.quantity,y()}catch(h){alert(`Ошибка: ${h.message}`)}},{title:"Редактировать позицию",submitLabel:"Сохранить",name:a.name,price:a.price,quantity:a.quantity});document.body.appendChild(l)}),c.querySelector(".del-btn").addEventListener("click",async()=>{if(confirm(`Удалить «${a.name}»?`))try{await z(t,a.id),n.items=n.items.filter(l=>l.id!==a.id),y()}catch(l){alert(`Ошибка: ${l.message}`)}}),q.appendChild(c)}),e.querySelector("#btn-photo").addEventListener("click",()=>{e.querySelector("#photo-input").click()}),e.querySelector("#photo-input").addEventListener("change",async a=>{var b;const c=(b=a.target.files)==null?void 0:b[0];if(!c)return;const u=e.querySelector("#btn-photo");u.textContent="⏳ Распознаю...",u.disabled=!0;try{const f=await N(t,c);n.items.push(...f),y()}catch(f){alert(`Ошибка: ${f.message}`),u.textContent="📷 Загрузить чек",u.disabled=!1}}),e.querySelector("#btn-add").addEventListener("click",()=>{const a=L(async(c,u,b)=>{try{const f=await k(t,c,u,b);n.items.push(f),y()}catch(f){alert(`Ошибка: ${f.message}`)}});document.body.appendChild(a)}),e.querySelector("#btn-results").addEventListener("click",r)}y()}async function H(e,t,r){e.innerHTML='<p style="padding:16px">Считаю...</p>';let n;try{n=await O(t)}catch(i){e.innerHTML=`<p style="padding:16px;color:red">Ошибка: ${i.message}</p>`;return}const s=n.participants.map(i=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
       <span>${i.displayName}</span>
       <b>${i.totalAmount.toFixed(2)}</b>
     </div>`).join(""),o=n.transfers.length?n.transfers.map(i=>`<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">
           ${i.fromName} → ${i.toName}: <b>${i.amount.toFixed(2)}</b>
         </div>`).join(""):'<p style="color:#888;padding:8px 0">Все в расчёте 🎉</p>';e.innerHTML=`
    <div>
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <button id="btn-back" style="border:none;background:none;font-size:22px;padding:0 8px 0 0;cursor:pointer">←</button>
        <h2>Итоги</h2>
      </div>
      <section style="margin-bottom:24px">
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Суммы участников</h3>
        ${s}
      </section>
      <section>
        <h3 style="margin-bottom:8px;color:#888;font-size:13px;text-transform:uppercase">Переводы</h3>
        ${o}
      </section>
    </div>
  `,e.querySelector("#btn-back").addEventListener("click",r)}function A(){var t,r,n;return new URLSearchParams(window.location.search).get("session")??((n=(r=(t=window.Telegram)==null?void 0:t.WebApp)==null?void 0:r.initDataUnsafe)==null?void 0:n.start_param)??null}async function D(){var s,o,i,y;(o=(s=window.Telegram)==null?void 0:s.WebApp)==null||o.ready(),(y=(i=window.Telegram)==null?void 0:i.WebApp)==null||y.expand();const e=document.getElementById("app"),t=A();if(!t){e.innerHTML='<p style="padding:16px;color:red">Нет ID сессии. Открой приложение через бота.</p>';return}function r(){P(e,t,n)}function n(){H(e,t,r)}r()}D().catch(e=>{document.getElementById("app").innerHTML=`<p style="padding:16px;color:red">Ошибка: ${e.message}</p>`});
