(()=>{
  const KEY="gameAlpiDeveloperMode";
  let active=localStorage.getItem(KEY)==="1";
  let taps=[];

  function ensureStyle(){
    if(document.getElementById("gameAlpiDevStyle"))return;
    const s=document.createElement("style");
    s.id="gameAlpiDevStyle";
    s.textContent=`
      .dev-only{display:none!important}
      body.developer-mode .dev-only{display:block!important}
      #gameAlpiDevBadge{position:fixed;z-index:9998;left:8px;bottom:8px;padding:6px 8px;border:1px solid rgba(93,184,255,.35);border-radius:999px;color:#bfe1ff;background:rgba(8,27,46,.94);font:800 8px/1 system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 8px 25px rgba(0,0,0,.3);pointer-events:none}
      #gameAlpiDevToast{position:fixed;z-index:9999;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);width:max-content;max-width:calc(100vw - 28px);padding:10px 13px;border:1px solid rgba(95,181,255,.28);border-radius:12px;color:#e8f5ff;background:rgba(8,29,49,.97);font:800 9px/1.35 system-ui,sans-serif;text-align:center;opacity:0;transition:.18s;pointer-events:none;box-shadow:0 18px 42px rgba(0,0,0,.4)}
      #gameAlpiDevToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      [data-dev-trigger]{user-select:none;-webkit-user-select:none}
    `;
    document.head.appendChild(s);
  }
  function badge(){
    let b=document.getElementById("gameAlpiDevBadge");
    if(active&&!b){b=document.createElement("div");b.id="gameAlpiDevBadge";b.textContent="🧪 DEV";document.body.appendChild(b)}
    if(!active&&b)b.remove();
  }
  function toast(text){
    let t=document.getElementById("gameAlpiDevToast");
    if(!t){t=document.createElement("div");t.id="gameAlpiDevToast";document.body.appendChild(t)}
    t.textContent=text;t.classList.add("show");clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove("show"),1800)
  }
  function apply(announce=false){
    ensureStyle();
    document.body.classList.toggle("developer-mode",active);
    badge();
    window.dispatchEvent(new CustomEvent("gamealpi:developerchange",{detail:{active}}));
    if(announce)toast(active?"🧪 Developer Mode aktif":"Developer Mode nonaktif");
  }
  function toggle(){active=!active;localStorage.setItem(KEY,active?"1":"0");apply(true)}
  function tap(){
    const now=Date.now();
    taps=taps.filter(x=>now-x<2600);
    taps.push(now);
    if(taps.length>=5){taps=[];toggle()}
  }
  function bind(){
    document.querySelectorAll("[data-dev-trigger]").forEach(el=>{
      if(el.dataset.devBound)return;
      el.dataset.devBound="1";
      el.addEventListener("click",tap);
    });
  }

  window.GameAlpiDev={
    isActive:()=>active,
    setActive:v=>{active=!!v;localStorage.setItem(KEY,active?"1":"0");apply(true)},
    toggle,
    toast
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{bind();apply(false)});
  else{bind();apply(false)}
})();