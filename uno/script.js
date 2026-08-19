const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const STORE="gameAlpiUnoV2";
let roomCode=null,playerId=null,token=null,playerName=null,isHost=false;
let room=null,players=[],hand=[],roomChannel=null,playerChannel=null,timerHandle=null;
let stacking=false,jumpIn=false,sevenZero=false,drawUntil=false,challenge4=false,turnSeconds=0,unoPenalty=true;
let pendingCard=null;
let actionBusy=false;
let routeBusy=false;
let routeQueued=false;
let toastTimer=null;
const UNO_TUTORIAL_KEY="gameAlpiUnoTutorialSeenV3";

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function normName(v){return v.trim().replace(/\s+/g," ").slice(0,20)}
function normCode(v){return v.replace(/\D/g,"").slice(0,6)}
function save(){localStorage.setItem(STORE,JSON.stringify({roomCode,playerId,token,playerName,isHost}))}
function clearSave(){localStorage.removeItem(STORE)}
function show(id){["setupScreen","lobbyScreen","gameScreen","resultScreen"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function pair(off,on,val){$(off).classList.toggle("active",!val);$(on).classList.toggle("active",!!val)}
function syncSettings(){pair("stackOffBtn","stackOnBtn",stacking);pair("jumpOffBtn","jumpOnBtn",jumpIn);pair("sevenOffBtn","sevenOnBtn",sevenZero);pair("drawUntilOffBtn","drawUntilOnBtn",drawUntil);pair("challengeOffBtn","challengeOnBtn",challenge4);pair("unoOffBtn","unoOnBtn",unoPenalty);$("turnTimerSelect").value=String(turnSeconds)}
function setConnection(ok,text){$("connectionText").textContent=text;$("connectionBadge").style.opacity=ok?"1":".65"}
function cardText(c){if(c.kind==="number")return String(c.value);if(c.kind==="skip")return "⊘";if(c.kind==="reverse")return "↻";if(c.kind==="draw2")return "+2";if(c.kind==="wild4")return "+4";return "W"}
function cardClass(c){return c.color||"wild"}
function isMyTurn(){return room?.current_player_id===playerId}
function canClick(c){if(room?.challenge_pending)return false;if(isMyTurn())return !!c.playable;return !!(room?.jump_in&&c.jump_playable)}
function joinUrl(){const u=new URL(location.href);u.search="";u.searchParams.set("room",roomCode);return u.toString()}

function friendlyError(err){
 const m=String(err?.message||err||"Terjadi kesalahan.");
 if(/room_code.*ambiguous/i.test(m))return "Database room belum memakai patch terbaru.";
 if(/not find the function|schema cache/i.test(m))return "Database UNO belum siap. Jalankan SQL setup/patch terlebih dahulu.";
 if(/Belum giliranmu/i.test(m))return "Bukan giliranmu.";
 if(/Kartu ini tidak dapat dimainkan/i.test(m))return "Kartu itu belum bisa dimainkan.";
 if(/Sesi tidak valid/i.test(m))return "Sesi pemain sudah kedaluwarsa. Masuk room lagi.";
 return m;
}
function setBusy(value, el=null){
 actionBusy=value;
 if(el)el.classList.toggle("action-busy",value);
}
function toast(text){
 let t=document.getElementById("gameToast");
 if(!t){
   t=document.createElement("div");t.id="gameToast";t.className="game-toast";
   document.body.appendChild(t);
 }
 t.textContent=text;
 t.classList.add("show");
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>t.classList.remove("show"),1800);
}
async function refreshGameState(){
 await loadRoom();
 await loadPlayers();
 if(room?.phase==="playing")await loadHand();
}
async function safeRoute(){
 if(routeBusy){routeQueued=true;return}
 routeBusy=true;
 try{await route()}finally{
   routeBusy=false;
   if(routeQueued){routeQueued=false;queueMicrotask(safeRoute)}
 }
}

async function loadRoom(){if(!roomCode)return null;const {data,error}=await db.from("color_clash_rooms").select("*").eq("room_code",roomCode).maybeSingle();if(error)return null;room=data;return data}
async function loadPlayers(){
 if(!roomCode)return[];
 const {data,error}=await db.from("color_clash_players").select("*").eq("room_code",roomCode).order("seat_order");
 if(error)return[];
 players=data||[];
 if(playerId&&!players.some(p=>String(p.id)===String(playerId))){await leaveLocal("Kamu sudah tidak berada di room.");return[]}
 return players
}
async function loadHand(){
 if(!playerId)return[];
 const {data,error}=await db.rpc("color_clash_get_my_hand",{p_player_id:playerId,p_player_token:token});
 if(error){$("gameMessage").textContent=error.message;return[]}
 hand=data||[];renderHand();return hand
}

function renderPlayersLobby(){
 $("playerCount").textContent=`${players.length} pemain`;
 $("playersList").innerHTML=players.map(p=>`
   <div class="player-row">
    <div class="player-main">
      <div class="avatar">${esc(p.player_name[0].toUpperCase())}</div>
      <div><div class="player-name">${esc(p.player_name)}</div><div class="player-sub">${p.is_host?"HOST":"Pemain "+p.seat_order}</div></div>
    </div>
    ${isHost&&!p.is_host?`<button class="kick" data-kick="${p.id}">Kick</button>`:""}
   </div>`).join("");
 document.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>kickPlayer(Number(b.dataset.kick)));
 $("startGameBtn").disabled=players.length<2;
}

function renderOpponents(){
 const others=players.filter(p=>p.id!==playerId);
 $("playersGameList").innerHTML=others.map((p,i)=>`
   <div class="opponent ${room?.current_player_id===p.id?"turn":""}">
     <div class="opp-avatar" style="background:${avatarGradient(i)}">${esc(p.player_name[0].toUpperCase())}<span class="opp-count">${p.card_count}</span></div>
     <b>${esc(p.player_name)}</b><span>${room?.current_player_id===p.id?"Giliran":"kartu"}</span>
   </div>`).join("");
}
function avatarGradient(i){
 const g=[
  "linear-gradient(135deg,#8c52dc,#f45d8b)",
  "linear-gradient(135deg,#2b77d4,#36bd9d)",
  "linear-gradient(135deg,#e36a3d,#f5b62d)",
  "linear-gradient(135deg,#3e6bd8,#7d55d8)",
  "linear-gradient(135deg,#23a55d,#3f88d5)"
 ];
 return g[i%g.length]
}
function renderTop(){
 const c={color:room?.top_color,kind:room?.top_kind,value:room?.top_value};
 $("topCard").className=`uno-card top-card ${cardClass(c)}`;
 $("topCard").innerHTML=`<span class="corner">GA</span><strong>${esc(cardText(c))}</strong>`;
 const names={red:"Merah",yellow:"Kuning",green:"Hijau",blue:"Biru"};
 $("activeColorText").textContent=`Warna: ${names[room?.active_color]||"-"}`;
 $("directionText").textContent=room?.direction===-1?"Arah ←":"Arah →";
}
function renderHand(){
 $("handCount").textContent=`${hand.length} kartu`;
 $("hand").innerHTML=hand.map((c,i)=>`
   <button class="uno-card ${cardClass(c)} ${canClick(c)?"playable":"disabled"}" data-card="${c.card_id}" style="z-index:${i+1}">
     <span class="corner">GA</span><strong>${esc(cardText(c))}</strong>
   </button>`).join("");
 document.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>selectCard(b.dataset.card));
 const my=players.find(p=>p.id===playerId);
 $("unoBtn").disabled=!room?.uno_penalty||!my||my.card_count!==1;
}
function renderTurn(){
 const current=players.find(p=>p.id===room?.current_player_id);
 const myTurn=isMyTurn();
 document.querySelector(".turn-banner")?.classList.toggle("my-turn",myTurn);
 document.querySelector(".turn-banner")?.classList.toggle("waiting",!myTurn);
 $("turnSmall").textContent=myTurn?"SEKARANG":"GILIRAN";
 $("turnTitle").textContent=myTurn?"Giliranmu":(current?.player_name||"Menunggu...");
 if(room?.challenge_pending&&room?.challenge_player_id===playerId){
   $("turnInstruction").textContent="Pilih Terima +4 atau Challenge.";
 }else if(myTurn&&room?.pending_draw>0){
   $("turnInstruction").textContent=room.stacking?"Stack kartu sejenis atau ambil penalti.":"Ambil kartu penalti.";
 }else if(myTurn){
   $("turnInstruction").textContent="Pilih kartu yang cocok atau tekan AMBIL.";
 }else{
   $("turnInstruction").textContent=`Tunggu ${current?.player_name||"pemain"} selesai bermain.`;
 }
 const pend=room?.pending_draw||0;
 $("pendingBanner").classList.toggle("hidden",pend<=0);
 if(pend>0)$("pendingBanner").textContent=`⚠️ Penalti +${pend}${room?.stacking?" • stacking aktif":""}`;
 const challengeMine=room?.challenge_pending&&room?.challenge_player_id===playerId;
 $("challengePanel").classList.toggle("hidden",!challengeMine);
 $("drawBtn").disabled=!myTurn||room?.challenge_pending;
 const vuln=room?.uno_vulnerable_player_id;
 $("catchBtn").classList.toggle("hidden",!room?.uno_penalty||!vuln||vuln===playerId);
 renderOpponents();
}
function startTurnTimer(){
 if(timerHandle)clearInterval(timerHandle);
 const tick=async()=>{
  if(!room||room.phase!=="playing"||!room.turn_seconds||!room.turn_started_at){$("turnTimer").textContent="∞";return}
  const end=new Date(room.turn_started_at).getTime()+room.turn_seconds*1000;
  const left=Math.max(0,Math.ceil((end-Date.now())/1000));
  $("turnTimer").textContent=`${left}s`;
  if(left<=0)await db.rpc("color_clash_timeout_turn",{p_room_code:roomCode});
 };
 tick();timerHandle=setInterval(tick,1000)
}

async function showLobby(){
 show("lobbyScreen");$("roomCodeDisplay").textContent=roomCode;
 $("hostBadge").classList.toggle("hidden",!isHost);$("hostControls").classList.toggle("hidden",!isHost);
 await loadRoom();await loadPlayers();renderPlayersLobby();
 if(isHost&&room){
  stacking=room.stacking||false;jumpIn=room.jump_in||false;sevenZero=room.seven_zero||false;drawUntil=room.draw_until_playable||false;
  challenge4=room.challenge_wild4||false;turnSeconds=room.turn_seconds||0;unoPenalty=room.uno_penalty!==false;syncSettings()
 }
}
async function showGame(){
 show("gameScreen");$("gameRoomCode").textContent=roomCode;
 await loadRoom();await loadPlayers();await loadHand();renderTop();renderTurn();startTurnTimer()
}
async function showResult(){
 show("resultScreen");await loadRoom();await loadPlayers();
 const w=players.find(p=>p.id===room?.winner_player_id);$("winnerName").textContent=w?.player_name||"Pemenang";
 $("backLobbyBtn").classList.toggle("hidden",!isHost);$("resultHint").classList.toggle("hidden",isHost)
}
async function route(){if(!room)return;if(room.phase==="lobby")await showLobby();else if(room.phase==="playing")await showGame();else await showResult()}

async function subscribe(){
 if(roomChannel)await db.removeChannel(roomChannel);
 if(playerChannel)await db.removeChannel(playerChannel);
 roomChannel=db.channel(`uno-room-${roomCode}-${Date.now()}`)
  .on("postgres_changes",{event:"*",schema:"public",table:"color_clash_rooms",filter:`room_code=eq.${roomCode}`},async p=>{
    if(p.eventType==="DELETE"){await leaveLocal("Room ditutup.");return}
    room=p.new;await safeRoute()
  }).subscribe(s=>{
    if(s==="SUBSCRIBED")setConnection(true,"Online");
    if(s==="CHANNEL_ERROR"||s==="TIMED_OUT")setConnection(false,"Menyambung ulang...");
  });
 playerChannel=db.channel(`uno-players-${roomCode}-${Date.now()}`)
  .on("postgres_changes",{event:"*",schema:"public",table:"color_clash_players",filter:`room_code=eq.${roomCode}`},async()=>{
    await loadPlayers();
    if(room?.phase==="lobby")renderPlayersLobby();
    else if(room?.phase==="playing"){await loadHand();renderTurn()}
  }).subscribe();
}
async function enter(){save();await loadRoom();if(!room){await leaveLocal("Room tidak ditemukan.");return}await subscribe();await safeRoute()}

async function createRoom(){
 if(actionBusy)return;
 const name=normName($("playerName").value);
 if(!name){$("setupMessage").textContent="Masukkan nama pemain terlebih dahulu.";return}
 setBusy(true,$("createRoomBtn"));$("setupMessage").textContent="";
 try{
  const {data,error}=await db.rpc("color_clash_create_room",{p_player_name:name});
  if(error||!data?.length){$("setupMessage").textContent=friendlyError(error||"Gagal membuat room.");return}
  const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=name;isHost=true;
  await enter()
 }finally{setBusy(false,$("createRoomBtn"))}
}
async function joinRoom(){
 if(actionBusy)return;
 const name=normName($("playerName").value),code=normCode($("roomCodeInput").value);
 if(!name){$("setupMessage").textContent="Masukkan nama pemain.";return}
 if(code.length!==6){$("setupMessage").textContent="Kode room harus 6 angka.";return}
 setBusy(true,$("joinRoomBtn"));$("setupMessage").textContent="";
 try{
  const {data,error}=await db.rpc("color_clash_join_room",{p_room_code:code,p_player_name:name});
  if(error||!data?.length){$("setupMessage").textContent=friendlyError(error||"Gagal gabung room.");return}
  const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=name;isHost=false;
  await enter()
 }finally{setBusy(false,$("joinRoomBtn"))}
}
async function kickPlayer(id){
 if(!confirm("Keluarkan pemain ini dari room?"))return;
 const {error}=await db.rpc("color_clash_kick_player",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_target_id:id});
 if(error)$("lobbyMessage").textContent=error.message
}
async function leave(){try{await db.rpc("color_clash_leave_room",{p_player_id:playerId,p_player_token:token})}catch{}await leaveLocal("")}
async function leaveLocal(msg){
 if(roomChannel)await db.removeChannel(roomChannel);if(playerChannel)await db.removeChannel(playerChannel);
 clearSave();roomCode=playerId=token=playerName=null;isHost=false;room=null;players=[];hand=[];show("setupScreen");$("setupMessage").textContent=msg||""
}

async function startGame(){
 if(actionBusy)return;
 setBusy(true,$("startGameBtn"));$("lobbyMessage").textContent="";
 try{
  const {error}=await db.rpc("color_clash_start_game",{
   p_room_code:roomCode,p_host_id:playerId,p_host_token:token,
   p_stacking:stacking,p_jump_in:jumpIn,p_seven_zero:sevenZero,
   p_draw_until_playable:drawUntil,p_challenge_wild4:challenge4,
   p_turn_seconds:turnSeconds,p_uno_penalty:unoPenalty
  });
  if(error)$("lobbyMessage").textContent=friendlyError(error);
  else toast("Game dimulai!");
 }finally{setBusy(false,$("startGameBtn"))}
}
async function drawCard(){
 if(actionBusy||!isMyTurn())return;
 setBusy(true,$("drawBtn"));$("gameMessage").textContent="";
 try{
  const {data,error}=await db.rpc("color_clash_draw",{p_player_id:playerId,p_player_token:token});
  if(error){$("gameMessage").textContent=friendlyError(error);return}
  if(data?.status==="playable_drawn")toast(`Mengambil ${data.drawn} kartu. Ada kartu yang bisa dimainkan.`);
  else toast(`Mengambil ${data?.drawn||0} kartu.`);
  await refreshGameState();renderTop();renderTurn()
 }finally{setBusy(false,$("drawBtn"))}
}
function selectCard(id){
 if(actionBusy)return;
 const c=hand.find(x=>x.card_id===id);
 if(!c||!canClick(c)){toast(isMyTurn()?"Kartu ini belum cocok.":"Tunggu giliranmu.");return;}
 pendingCard=c;
 if(c.kind==="wild"||c.kind==="wild4"){openSheet("colorModal");return}
 if(c.kind==="number"&&c.value===7&&room?.seven_zero){renderSwap();openSheet("swapModal");return}
 playCard(c,null,null)
}
async function playCard(c,color,target){
 if(actionBusy)return;
 closeSheets();
 setBusy(true);
 $("gameMessage").textContent="";
 try{
  const {error}=await db.rpc("color_clash_play_card",{p_player_id:playerId,p_player_token:token,p_card_id:c.card_id,p_chosen_color:color,p_swap_target_id:target});
  if(error){$("gameMessage").textContent=friendlyError(error);return}
  pendingCard=null;
  await refreshGameState();renderTop();renderTurn();
  toast("Kartu dimainkan")
 }finally{setBusy(false)}
}
function renderSwap(){
 $("swapPlayers").innerHTML=players.filter(p=>p.id!==playerId).map(p=>`<button class="swap-player" data-swap="${p.id}">${esc(p.player_name)} • ${p.card_count} kartu</button>`).join("");
 document.querySelectorAll("[data-swap]").forEach(b=>b.onclick=()=>playCard(pendingCard,null,Number(b.dataset.swap)))
}
function openSheet(id){$(id).classList.remove("hidden")}
function closeSheets(){["colorModal","swapModal","helpModal"].forEach(id=>$(id).classList.add("hidden"))}
async function callUno(){
 if(actionBusy)return;
 setBusy(true,$("unoBtn"));
 try{
  const {error}=await db.rpc("color_clash_call_uno",{p_player_id:playerId,p_player_token:token});
  if(error)$("gameMessage").textContent=friendlyError(error);else toast("UNO! 📣");
 }finally{setBusy(false,$("unoBtn"))}
}
async function catchUno(){
 if(actionBusy)return;
 setBusy(true,$("catchBtn"));
 try{
  const {error}=await db.rpc("color_clash_catch_uno",{p_player_id:playerId,p_player_token:token});
  if(error)$("gameMessage").textContent=friendlyError(error);else toast("Tertangkap! +2 kartu");
 }finally{setBusy(false,$("catchBtn"))}
}
async function accept4(){const {error}=await db.rpc("color_clash_accept_wild4",{p_player_id:playerId,p_player_token:token});if(error)$("gameMessage").textContent=friendlyError(error)}
async function challengeWild4(){const {data,error}=await db.rpc("color_clash_challenge_wild4",{p_player_id:playerId,p_player_token:token});if(error){$("gameMessage").textContent=friendlyError(error);return}$("gameMessage").textContent=data==="challenge_success"?"Challenge berhasil! Pemberi +4 mengambil 4.":"Challenge gagal. Kamu mengambil 6."}
async function backLobby(){const {error}=await db.rpc("color_clash_reset_lobby",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});if(error)$("resultHint").textContent=friendlyError(error)}

function setPair(off,on,setter){$(off).onclick=()=>{setter(false);syncSettings()};$(on).onclick=()=>{setter(true);syncSettings()}}
setPair("stackOffBtn","stackOnBtn",v=>stacking=v);
setPair("jumpOffBtn","jumpOnBtn",v=>jumpIn=v);
setPair("sevenOffBtn","sevenOnBtn",v=>sevenZero=v);
setPair("drawUntilOffBtn","drawUntilOnBtn",v=>drawUntil=v);
setPair("challengeOffBtn","challengeOnBtn",v=>challenge4=v);
setPair("unoOffBtn","unoOnBtn",v=>unoPenalty=v);
$("turnTimerSelect").onchange=e=>turnSeconds=Number(e.target.value);

$("createRoomBtn").onclick=createRoom;$("joinRoomBtn").onclick=joinRoom;
$("roomCodeInput").oninput=()=>$("roomCodeInput").value=normCode($("roomCodeInput").value);
$("startGameBtn").onclick=startGame;$("leaveRoomBtn").onclick=leave;$("drawBtn").onclick=drawCard;
$("unoBtn").onclick=callUno;$("catchBtn").onclick=catchUno;$("acceptWild4Btn").onclick=accept4;$("challengeWild4Btn").onclick=challengeWild4;$("backLobbyBtn").onclick=backLobby;
$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="✓";setTimeout(()=>$("copyCodeBtn").textContent="Salin",900)}catch{}};
$("showQrBtn").onclick=()=>{$("qrPanel").classList.toggle("hidden");if(!$("qrPanel").classList.contains("hidden")){const b=$("qrcode");b.innerHTML="";if(window.QRCode)new QRCode(b,{text:joinUrl(),width:160,height:160,correctLevel:QRCode.CorrectLevel.M})}};
document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>playCard(pendingCard,b.dataset.color,null));
document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeSheets);
$("closeHelpBtn").onclick=closeSheets;

function initHelpTips(){
 const pop=$("helpPopover");
 document.querySelectorAll(".help").forEach(b=>{
  const open=()=>{pop.textContent=b.dataset.help||"";pop.classList.remove("hidden");const r=b.getBoundingClientRect();const w=Math.min(280,innerWidth-24);let left=Math.max(12,Math.min(r.left+r.width/2-w/2,innerWidth-w-12));let top=r.bottom+6;if(top+pop.offsetHeight>innerHeight-12)top=Math.max(12,r.top-pop.offsetHeight-6);pop.style.left=left+"px";pop.style.top=top+"px"};
  b.onmouseenter=open;b.onfocus=open;b.onclick=e=>{e.preventDefault();e.stopPropagation();pop.classList.contains("hidden")?open():pop.classList.add("hidden")};
 });
 document.addEventListener("click",()=>pop.classList.add("hidden"))
}
initHelpTips();syncSettings();


function initUnoTutorial(){
 const modal=$("firstTutorialModal");
 const slides=[...document.querySelectorAll(".uno-tutorial-slide")];
 const stepText=$("unoTutorialStep"),dots=$("unoTutorialDots");
 const next=$("unoTutorialNext"),close=$("unoTutorialClose");
 let step=0;
 function render(){
  slides.forEach((s,i)=>s.classList.toggle("hidden",i!==step));
  stepText.textContent=`${step+1} / ${slides.length}`;
  dots.innerHTML=slides.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("");
  next.textContent=step===slides.length-1?"Mulai Main":"Lanjut";
 }
 function open(){step=0;render();modal.classList.remove("hidden")}
 function shut(){modal.classList.add("hidden");localStorage.setItem(UNO_TUTORIAL_KEY,"1")}
 next.onclick=()=>{if(step<slides.length-1){step++;render()}else shut()};
 close.onclick=shut;
 modal.addEventListener("click",e=>{if(e.target===modal)shut()});
 $("howToPlayBtn").onclick=open;
 $("lobbyHelpBtn").onclick=open;
 $("gameHelpBtn").onclick=open;
 if(localStorage.getItem(UNO_TUTORIAL_KEY)!=="1")setTimeout(open,300);
}
initUnoTutorial();

window.addEventListener("online",async()=>{setConnection(false,"Menyambung...");if(roomCode){await refreshGameState();await subscribe();await safeRoute()}});
window.addEventListener("offline",()=>setConnection(false,"Offline"));
document.addEventListener("visibilitychange",async()=>{
 if(document.visibilityState==="visible"&&roomCode){
  await refreshGameState();await safeRoute();
 }
});

async function restore(){
 const raw=localStorage.getItem(STORE);if(!raw)return false;
 try{const x=JSON.parse(raw);roomCode=x.roomCode;playerId=x.playerId;token=x.token;playerName=x.playerName;isHost=x.isHost;if(roomCode&&playerId&&token){await enter();return true}}catch{clearSave()}
 return false
}
async function boot(){
 try{await db.rpc("color_clash_cleanup_rooms");setConnection(true,"Online")}catch{setConnection(false,"Database belum siap")}
 const q=new URLSearchParams(location.search).get("room");if(q)$("roomCodeInput").value=normCode(q);
 const ok=await restore();if(!ok)show("setupScreen")
}
boot();