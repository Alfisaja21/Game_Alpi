const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const STORE="gameAlpiUnoV2";
const UNO_TUTORIAL_KEY="gameAlpiUnoTutorialSeenV3";

let roomCode=null,playerId=null,token=null,playerName=null,isHost=false;
let room=null,players=[],hand=[],roomChannel=null,playerChannel=null,presenceChannel=null,timerHandle=null;
let stacking=false,jumpIn=false,sevenZero=false,drawUntil=false,challenge4=false,turnSeconds=30,unoPenalty=true;
let pendingCard=null,actionBusy=false,routeBusy=false,routeQueued=false,toastTimer=null,timeoutBusy=false;
let onlinePlayers=new Set(),offlineSince=new Map();
let multiCandidates=[],multiSelected=new Set(),multiAnchor=null,multiFinalColor=null,multiFinalCardId=null,multiSwapTarget=null;
let unoBotTokens=new Map(),unoBotTimer=null,unoBotBusy=false;

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
function groupKey(c){return c.kind==="number"?`number:${c.value}`:`kind:${c.kind}`}
function sameGroup(a,b){return groupKey(a)===groupKey(b)}
function colorName(c){return({red:"Merah",yellow:"Kuning",green:"Hijau",blue:"Biru"})[c]||"-"}

function friendlyError(err){
 const m=String(err?.message||err||"Terjadi kesalahan.");
 if(/room_code.*ambiguous/i.test(m))return "Database room belum memakai patch terbaru.";
 if(/color_clash_play_cards|schema cache|not find the function/i.test(m))return "Database UNO belum memakai SQL V4.";
 if(/Belum giliranmu/i.test(m))return "Bukan giliranmu.";
 if(/Kartu ini tidak dapat dimainkan|Tidak ada kartu awal/i.test(m))return "Kartu itu belum bisa dimainkan.";
 if(/Sesi tidak valid/i.test(m))return "Sesi pemain sudah kedaluwarsa. Masuk room lagi.";
 return m;
}
function setBusy(value,el=null){actionBusy=value;if(el)el.classList.toggle("action-busy",value)}
function toast(text){
 let t=document.getElementById("gameToast");
 if(!t){t=document.createElement("div");t.id="gameToast";t.className="game-toast";document.body.appendChild(t)}
 t.textContent=text;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),1800)
}
function showDrawNotice(count,{penalty=false,nextName="",title=null,detail="",footerText=""}={}){
 $("drawNoticeIcon").textContent=penalty?"⚠️":"🃏";
 $("drawNoticeTitle").textContent=title||`+${count} KARTU`;
 $("drawNoticeText").textContent=detail||(penalty?`Kamu mengambil ${count} kartu penalti.`:`Kamu mengambil ${count} kartu.`);
 $("drawNoticeNext").textContent=footerText||(nextName?`Giliran berikutnya: ${nextName}`:"");
 $("drawNotice").classList.remove("hidden");
 setTimeout(()=>$("drawNotice").classList.add("hidden"),1550);
}

async function loadRoom(){
 if(!roomCode)return null;
 const {data,error}=await db.from("color_clash_rooms").select("*").eq("room_code",roomCode).maybeSingle();
 if(error)return null;room=data;return data
}
async function loadPlayers(){
 if(!roomCode)return[];
 const {data,error}=await db.from("color_clash_players").select("*").eq("room_code",roomCode).order("seat_order");
 if(error)return[];
 players=data||[];
 const me=players.find(p=>String(p.id)===String(playerId));
 if(playerId&&!me){await leaveLocal("Kamu sudah tidak berada di room.");return[]}
 if(me){isHost=!!me.is_host;save()}
 return players
}
async function loadHand(){
 if(!playerId)return[];
 const {data,error}=await db.rpc("color_clash_get_my_hand",{p_player_id:playerId,p_player_token:token});
 if(error){$("gameMessage").textContent=friendlyError(error);return[]}
 hand=data||[];renderHand();return hand
}
async function refreshGameState(){await loadRoom();await loadPlayers();if(room?.phase==="playing")await loadHand()}
async function safeRoute(){
 if(routeBusy){routeQueued=true;return}
 routeBusy=true;
 try{await route()}finally{routeBusy=false;if(routeQueued){routeQueued=false;queueMicrotask(safeRoute)}}
}

function renderPlayersLobby(){
 $("playerCount").textContent=`${players.length} pemain`;
 $("playersList").innerHTML=players.map(p=>`
  <div class="player-row">
   <div class="player-main">
    <div class="avatar">${esc(p.player_name[0].toUpperCase())}</div>
    <div><div class="player-name">${esc(p.player_name)}${p.is_bot?'<span class="bot-badge">BOT</span>':""}</div><div class="player-sub">${p.is_host?"HOST":p.is_bot?"BOT • Test":"Pemain "+p.seat_order}</div></div>
   </div>
   ${isHost&&!p.is_host?`<button class="kick" data-kick="${p.id}">Kick</button>`:""}
  </div>`).join("");
 document.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>kickPlayer(Number(b.dataset.kick)));
 $("hostBadge").classList.toggle("hidden",!isHost);
 $("hostControls").classList.toggle("hidden",!isHost);
 $("startGameBtn").disabled=!isHost||players.length<2
}
function avatarGradient(i){
 return[
  "linear-gradient(135deg,#8c52dc,#f45d8b)",
  "linear-gradient(135deg,#2b77d4,#36bd9d)",
  "linear-gradient(135deg,#e36a3d,#f5b62d)",
  "linear-gradient(135deg,#3e6bd8,#7d55d8)",
  "linear-gradient(135deg,#23a55d,#3f88d5)"
 ][i%5]
}
function renderOpponents(){
 const others=players.filter(p=>p.id!==playerId);
 $("playersGameList").innerHTML=others.map((p,i)=>{
  const online=!!p.is_bot||onlinePlayers.has(Number(p.id));
  return `<div class="opponent ${p.is_bot?"bot":""} ${room?.current_player_id===p.id?"turn":""} ${online?"":"offline"}">
   <div class="opp-avatar" style="background:${avatarGradient(i)}">${esc(p.player_name[0].toUpperCase())}<span class="opp-count">${p.card_count}</span></div>
   <b>${esc(p.player_name)}${p.is_bot?" 🤖":""}${p.is_host?" ★":""}</b>
   <span class="opp-online">${p.is_bot?"BOT":online?"Online":"Terputus"}</span>
  </div>`
 }).join("")
}
function renderTop(){
 const c={color:room?.top_color,kind:room?.top_kind,value:room?.top_value};
 $("topCard").className=`uno-card top-card ${cardClass(c)}`;
 $("topCard").innerHTML=`<span class="corner">GA</span><strong>${esc(cardText(c))}</strong>`;
 $("activeColorText").textContent=`Warna: ${colorName(room?.active_color)}`;
 $("directionText").textContent=room?.direction===-1?"Arah ←":"Arah →"
}
function renderHand(){
 $("handCount").textContent=`${hand.length} kartu`;
 const playableGroups=new Set(hand.filter(c=>canClick(c)).map(groupKey));
 $("hand").innerHTML=hand.map((c,i)=>{
  const groupAvailable=playableGroups.has(groupKey(c))&&hand.filter(x=>sameGroup(x,c)).length>1;
  return `<button class="uno-card ${cardClass(c)} ${canClick(c)?"playable":"disabled"} ${groupAvailable?"same-group":""}" data-card="${c.card_id}" style="z-index:${i+1}">
    <span class="corner">GA</span><strong>${esc(cardText(c))}</strong>
   </button>`
 }).join("");
 document.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>selectCard(b.dataset.card));
 const my=players.find(p=>p.id===playerId);
 $("unoBtn").disabled=!room?.uno_penalty||!my||my.card_count!==1
}
function renderTurn(){
 const current=players.find(p=>p.id===room?.current_player_id);
 const myTurn=isMyTurn();
 document.querySelector(".turn-banner")?.classList.toggle("my-turn",myTurn);
 document.querySelector(".turn-banner")?.classList.toggle("waiting",!myTurn);
 $("turnSmall").textContent=myTurn?"SEKARANG":"GILIRAN";
 $("turnTitle").textContent=myTurn?"Giliranmu":(current?.player_name||"Menunggu...");
 const currentOnline=current?(!!current.is_bot||onlinePlayers.has(Number(current.id))):true;
 $("turnConnectionHint").classList.toggle("hidden",currentOnline||!current);
 if(room?.challenge_pending&&room?.challenge_player_id===playerId){
  $("turnInstruction").textContent="Pilih Terima +4 atau Challenge.";
 }else if(myTurn&&room?.pending_draw>0){
  $("turnInstruction").textContent=room.stacking?"Stack +2/+4 sejenis atau ambil penalti.":"Ambil kartu penalti.";
 }else if(myTurn){
  $("turnInstruction").textContent="Pilih kartu yang cocok atau tekan AMBIL.";
 }else if(!currentOnline&&current){
  $("turnInstruction").textContent=`Menunggu ${current.player_name} reconnect maksimal 30 detik.`;
 }else{
  $("turnInstruction").textContent=`Tunggu ${current?.player_name||"pemain"} selesai bermain.`;
 }
 const pend=room?.pending_draw||0;
 $("pendingBanner").classList.toggle("hidden",pend<=0);
 if(pend>0)$("pendingBanner").textContent=`⚠️ Penalti +${pend}${room?.stacking?" • stacking aktif":""}`;
 const challengeMine=room?.challenge_pending&&room?.challenge_player_id===playerId;
 $("challengePanel").classList.toggle("hidden",!challengeMine);
 $("drawBtn").disabled=!myTurn||room?.challenge_pending||actionBusy;
 const vuln=room?.uno_vulnerable_player_id;
 $("catchBtn").classList.toggle("hidden",!room?.uno_penalty||!vuln||vuln===playerId);
 renderOpponents();
 maybeScheduleUnoBot()
}

async function timeoutTurn(offline=false,currentId=null){
 if(timeoutBusy||!roomCode)return;
 timeoutBusy=true;
 try{
  if(offline&&currentId&&Number(currentId)!==Number(playerId)){
   const {error}=await db.rpc("color_clash_offline_timeout",{p_reporter_id:playerId,p_reporter_token:token,p_offline_player_id:Number(currentId)});
   if(error&&!/schema cache|not find the function/i.test(String(error.message||"")))console.warn(error);
  }else{
   await db.rpc("color_clash_timeout_turn",{p_room_code:roomCode});
  }
 }finally{setTimeout(()=>timeoutBusy=false,900)}
}

function unoBotDelay(){const el=$("unoBotSpeed");return Number(el?.value||localStorage.getItem("gameAlpiUnoBotSpeed")||550)}
async function refreshUnoBotTokens(){
 if(!isHost||!roomCode)return;
 const {data,error}=await db.rpc("color_clash_get_bot_sessions",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});
 if(error)return;
 unoBotTokens=new Map((data||[]).map(x=>[Number(x.player_id),x.player_token]))
}
function chooseUnoBotColor(cards){
 const count={red:0,yellow:0,green:0,blue:0};
 cards.forEach(c=>{if(c.color&&count[c.color]!=null)count[c.color]++});
 return Object.entries(count).sort((a,b)=>b[1]-a[1])[0]?.[0]||["red","yellow","green","blue"][Math.floor(Math.random()*4)]
}
function botGroupKey(c){return c.kind==="number"?`number:${c.value}`:`kind:${c.kind}`}
function chooseUnoBotGroup(cards){
 const playable=cards.filter(c=>c.playable);
 if(!playable.length)return null;
 const weights={wild4:90,draw2:80,skip:70,reverse:60,wild:50,number:20};
 const candidates=playable.map(anchor=>{
   const group=cards.filter(c=>botGroupKey(c)===botGroupKey(anchor));
   return {anchor,group,score:(weights[anchor.kind]||10)+(group.length-1)*18+Math.random()*6}
 }).sort((a,b)=>b.score-a.score);
 return candidates[0]
}
async function maybeUnoBotCallUno(botId,botToken){
 await new Promise(r=>setTimeout(r,100));
 const p=players.find(x=>Number(x.id)===Number(botId));
 if(room?.uno_penalty&&p?.card_count===1){
   await db.rpc("color_clash_call_uno",{p_player_id:botId,p_player_token:botToken})
 }
}
function maybeScheduleUnoBot(){
 if(!isHost||unoBotBusy||unoBotTimer||!room||room.phase!=="playing")return;
 const current=players.find(p=>Number(p.id)===Number(room.current_player_id));
 if(!current?.is_bot)return;
 unoBotTimer=setTimeout(async()=>{unoBotTimer=null;await runUnoBot(Number(current.id))},unoBotDelay())
}
async function runUnoBot(botId){
 if(unoBotBusy)return;unoBotBusy=true;
 try{
   await loadRoom();await loadPlayers();
   const current=players.find(p=>Number(p.id)===Number(room?.current_player_id));
   if(!current?.is_bot||Number(current.id)!==Number(botId)||room?.phase!=="playing")return;
   if(!unoBotTokens.has(botId))await refreshUnoBotTokens();
   const botToken=unoBotTokens.get(botId);if(!botToken)return;

   if(room.challenge_pending&&Number(room.challenge_player_id)===botId){
     if(Math.random()<0.22)await db.rpc("color_clash_challenge_wild4",{p_player_id:botId,p_player_token:botToken});
     else await db.rpc("color_clash_accept_wild4",{p_player_id:botId,p_player_token:botToken});
     return
   }

   const {data:cards,error}=await db.rpc("color_clash_get_my_hand",{p_player_id:botId,p_player_token:botToken});
   if(error)return;
   const choice=chooseUnoBotGroup(cards||[]);
   if(!choice){
     await db.rpc("color_clash_draw",{p_player_id:botId,p_player_token:botToken});
     setTimeout(()=>maybeScheduleUnoBot(),120);
     return
   }

   const ids=choice.group.map(c=>c.card_id);
   let final=choice.group[choice.group.length-1];
   let chosenColor=null,swapTarget=null;
   if(choice.anchor.kind==="wild"||choice.anchor.kind==="wild4"){
     const remain=(cards||[]).filter(c=>!ids.includes(c.card_id));
     chosenColor=chooseUnoBotColor(remain);
   }else if(choice.anchor.kind==="number"){
     const remain=(cards||[]).filter(c=>!ids.includes(c.card_id));
     const best=chooseUnoBotColor(remain);
     const preferred=choice.group.find(c=>c.color===best);
     if(preferred)final=preferred;
     if(Number(choice.anchor.value)===7&&room.seven_zero){
       const targets=players.filter(p=>Number(p.id)!==botId);
       swapTarget=targets[Math.floor(Math.random()*targets.length)]?.id||null
     }
   }

   await db.rpc("color_clash_play_cards",{
     p_player_id:botId,p_player_token:botToken,p_card_ids:ids,p_final_card_id:final.card_id,
     p_chosen_color:chosenColor,p_swap_target_id:swapTarget
   });
   await loadPlayers();await loadRoom();await maybeUnoBotCallUno(botId,botToken)
 }finally{
   unoBotBusy=false;
   setTimeout(()=>maybeScheduleUnoBot(),100)
 }
}
async function addUnoBots(count){
 if(!isHost)return;
 const {error}=await db.rpc("color_clash_add_bots",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_count:count});
 if(error){$("lobbyMessage").textContent=friendlyError(error);return}
 await loadPlayers();await refreshUnoBotTokens();renderPlayersLobby()
}
async function removeUnoBots(){
 if(!isHost)return;
 const {error}=await db.rpc("color_clash_remove_bots",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});
 if(error){$("lobbyMessage").textContent=friendlyError(error);return}
 await loadPlayers();await refreshUnoBotTokens();renderPlayersLobby()
}

function startTurnTimer(){
 if(timerHandle)clearInterval(timerHandle);
 const tick=async()=>{
  const timer=$("turnTimer");
  timer.classList.remove("warning","danger");
  if(!room||room.phase!=="playing"||!room.current_player_id){timer.textContent="∞";return}
  const currentId=Number(room.current_player_id);
  const currentPlayer=players.find(p=>Number(p.id)===currentId);const online=!!currentPlayer?.is_bot||onlinePlayers.has(currentId);
  let left=null;

  if(!online){
   if(!offlineSince.has(currentId))offlineSince.set(currentId,Date.now());
   left=Math.max(0,Math.ceil((offlineSince.get(currentId)+30000-Date.now())/1000));
  }else{
   offlineSince.delete(currentId);
   if(!room.turn_seconds||!room.turn_started_at){timer.textContent="∞";return}
   const end=new Date(room.turn_started_at).getTime()+room.turn_seconds*1000;
   left=Math.max(0,Math.ceil((end-Date.now())/1000))
  }

  timer.textContent=`${left}s`;
  if(left<=10)timer.classList.add("warning");
  if(left<=5)timer.classList.add("danger");
  if(left<=0)await timeoutTurn(!online,currentId)
 };
 tick();timerHandle=setInterval(tick,500)
}

async function showLobby(){
 show("lobbyScreen");$("roomCodeDisplay").textContent=roomCode;
 await loadRoom();await loadPlayers();if(isHost)await refreshUnoBotTokens();renderPlayersLobby();
 if(isHost&&room){
  stacking=!!room.stacking;jumpIn=!!room.jump_in;sevenZero=!!room.seven_zero;drawUntil=!!room.draw_until_playable;
  challenge4=!!room.challenge_wild4;turnSeconds=[0,15,30,45,60].includes(Number(room.turn_seconds))?Number(room.turn_seconds):30;
  unoPenalty=room.uno_penalty!==false;syncSettings()
 }
}
async function showGame(){
 show("gameScreen");$("gameRoomCode").textContent=roomCode;
 await loadRoom();await loadPlayers();if(isHost)await refreshUnoBotTokens();await loadHand();renderTop();renderTurn();startTurnTimer()
}
async function showResult(){
 show("resultScreen");await loadRoom();await loadPlayers();
 const w=players.find(p=>p.id===room?.winner_player_id);$("winnerName").textContent=w?.player_name||"Pemenang";
 $("backLobbyBtn").classList.toggle("hidden",!isHost);$("resultHint").classList.toggle("hidden",isHost)
}
async function route(){if(!room)return;if(room.phase==="lobby")await showLobby();else if(room.phase==="playing")await showGame();else await showResult()}

function presenceIds(){
 if(!presenceChannel)return new Set();
 const state=presenceChannel.presenceState();
 const ids=[];
 Object.values(state).flat().forEach(p=>{if(p?.player_id!=null)ids.push(Number(p.player_id))});
 return new Set(ids)
}
function handlePresence(){
 const previous=new Set(onlinePlayers);
 onlinePlayers=presenceIds();
 const now=Date.now();
 players.forEach(p=>{
  const id=Number(p.id);
  if(onlinePlayers.has(id))offlineSince.delete(id);
  else if(previous.has(id)&&!offlineSince.has(id))offlineSince.set(id,now);
  else if(!previous.has(id)&&!offlineSince.has(id))offlineSince.set(id,now);
 });
 if(room?.phase==="playing"){renderTurn();startTurnTimer()}
}

async function subscribe(){
 if(roomChannel)await db.removeChannel(roomChannel);
 if(playerChannel)await db.removeChannel(playerChannel);
 if(presenceChannel)await db.removeChannel(presenceChannel);

 roomChannel=db.channel(`uno-room-${roomCode}-${Date.now()}`)
  .on("postgres_changes",{event:"*",schema:"public",table:"color_clash_rooms",filter:`room_code=eq.${roomCode}`},async p=>{
   if(p.eventType==="DELETE"){await leaveLocal("Room ditutup.");return}
   room=p.new;await safeRoute()
  }).subscribe(s=>{
   if(s==="SUBSCRIBED")setConnection(true,"Online");
   if(s==="CHANNEL_ERROR"||s==="TIMED_OUT")setConnection(false,"Menyambung ulang...")
  });

 playerChannel=db.channel(`uno-players-${roomCode}-${Date.now()}`)
  .on("postgres_changes",{event:"*",schema:"public",table:"color_clash_players",filter:`room_code=eq.${roomCode}`},async()=>{
   await loadPlayers();
   if(room?.phase==="lobby")renderPlayersLobby();
   else if(room?.phase==="playing"){await loadHand();renderTurn()}
  }).subscribe();

 presenceChannel=db.channel(`uno-presence-${roomCode}`,{config:{presence:{key:String(playerId)}}})
  .on("presence",{event:"sync"},handlePresence)
  .on("presence",{event:"join"},handlePresence)
  .on("presence",{event:"leave"},handlePresence)
  .subscribe(async status=>{
   if(status==="SUBSCRIBED"){
    await presenceChannel.track({player_id:Number(playerId),player_name:playerName,online_at:new Date().toISOString()});
    const {error}=await db.rpc("color_clash_reconnect",{p_player_id:playerId,p_player_token:token});
    if(!error){await loadRoom();renderTurn();startTurnTimer()}
   }
  })
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
  const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=name;isHost=true;await enter()
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
  const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=name;isHost=false;await enter()
 }finally{setBusy(false,$("joinRoomBtn"))}
}
async function kickPlayer(id){
 if(actionBusy||!isHost)return;
 if(!confirm("Keluarkan pemain ini dari room?"))return;
 const {error}=await db.rpc("color_clash_kick_player",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_target_id:id});
 if(error)$("lobbyMessage").textContent=friendlyError(error)
}
async function leave(){
 if(actionBusy)return;
 setBusy(true);
 try{
  const {error}=await db.rpc("color_clash_leave_room",{p_player_id:playerId,p_player_token:token});
  if(error){const target=room?.phase==="playing"?$("gameMessage"):$("lobbyMessage");if(target)target.textContent=friendlyError(error);return}
  await leaveLocal("")
 }finally{setBusy(false)}
}
async function leaveLocal(msg){
 if(roomChannel)await db.removeChannel(roomChannel);
 if(playerChannel)await db.removeChannel(playerChannel);
 if(presenceChannel)await db.removeChannel(presenceChannel);
 clearSave();roomCode=playerId=token=playerName=null;isHost=false;room=null;players=[];hand=[];onlinePlayers.clear();offlineSince.clear();
 show("setupScreen");$("setupMessage").textContent=msg||""
}

async function startGame(){
 if(actionBusy)return;
 setBusy(true,$("startGameBtn"));$("lobbyMessage").textContent="";
 try{
  const {error}=await db.rpc("color_clash_start_game",{
   p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_stacking:stacking,p_jump_in:jumpIn,p_seven_zero:sevenZero,
   p_draw_until_playable:drawUntil,p_challenge_wild4:challenge4,p_turn_seconds:turnSeconds,p_uno_penalty:unoPenalty
  });
  if(error)$("lobbyMessage").textContent=friendlyError(error);else toast("Game dimulai!")
 }finally{setBusy(false,$("startGameBtn"))}
}
async function drawCard(){
 if(actionBusy||!isMyTurn())return;
 setBusy(true,$("drawBtn"));$("gameMessage").textContent="";
 try{
  const beforeIds=new Set(hand.map(c=>c.card_id));
  const beforeCount=hand.length;
  const {data,error}=await db.rpc("color_clash_draw",{p_player_id:playerId,p_player_token:token});
  if(error){$("gameMessage").textContent=friendlyError(error);return}
  await refreshGameState();renderTop();renderTurn();
  const count=Number(data?.drawn??Math.max(0,hand.length-beforeCount));
  const next=players.find(p=>p.id===room?.current_player_id);
  const fresh=hand.filter(c=>!beforeIds.has(c.card_id));
  let detail="";
  if(count===1&&fresh.length===1){
   const c=fresh[0];
   detail=c.color?`Kamu mendapat ${colorName(c.color)} ${cardText(c)}.`:`Kamu mendapat ${cardText(c)}.`;
  }
  const playable=data?.status==="playable_drawn";
  showDrawNotice(count,{
   penalty:data?.status==="penalty_draw",
   nextName:playable?"":(next?.player_name||""),
   detail,
   footerText:playable?"Ada kartu yang bisa dimainkan • giliran tetap kamu":""
  })
 }finally{setBusy(false,$("drawBtn"))}
}

function groupCandidatesFor(c){return hand.filter(x=>sameGroup(x,c))}
function selectCard(id){
 if(actionBusy)return;
 const c=hand.find(x=>x.card_id===id);
 if(!c||!canClick(c)){toast(isMyTurn()?"Kartu ini belum cocok.":"Tunggu giliranmu.");return}
 pendingCard=c;
 const candidates=groupCandidatesFor(c);
 if(isMyTurn()&&candidates.length>1){
  openMultiAction(c,candidates);
  return
 }
 if(c.kind==="wild"||c.kind==="wild4"){openSheet("colorModal");return}
 if(c.kind==="number"&&c.value===7&&room?.seven_zero){renderSwap(()=>playCards([c.card_id],c.card_id,null,multiSwapTarget));openSheet("swapModal");return}
 playCards([c.card_id],c.card_id,null,null)
}

function openMultiAction(anchor,candidates){
 multiAnchor=anchor;multiCandidates=candidates;multiSelected=new Set(candidates.map(c=>c.card_id));multiSwapTarget=null;
 if(anchor.kind==="wild"||anchor.kind==="wild4"){multiFinalColor=room?.active_color||"red";multiFinalCardId=anchor.card_id}
 else{multiFinalColor=anchor.color;multiFinalCardId=anchor.card_id}
 $("multiRuleText").textContent=anchor.kind==="number"
  ?`Semua kartu angka ${anchor.value} boleh dibuang bersama. Pilih jumlah dan warna kartu terakhir.`
  :`Kartu ${cardText(anchor)} dengan jenis yang sama boleh dibuang bersama. Pilih jumlah${anchor.color?", lalu pilih warna kartu terakhir":""}.`;
 renderMultiAction();openSheet("multiActionModal")
}
function renderMultiAction(){
 $("multiSelectedCount").textContent=`${multiSelected.size} dipilih`;
 $("selectAllMultiBtn").textContent=multiSelected.size===multiCandidates.length?"Pilih 1 Saja":"Pilih Semua";
 $("multiCardList").innerHTML=multiCandidates.map(c=>`
  <button class="multi-pick ${cardClass(c)} ${multiSelected.has(c.card_id)?"selected":""}" data-multi="${c.card_id}">
   ${esc(cardText(c))}${multiSelected.has(c.card_id)?'<span class="pick-check">✓</span>':""}
  </button>`).join("");
 document.querySelectorAll("[data-multi]").forEach(b=>b.onclick=()=>toggleMulti(b.dataset.multi));
 renderFinalColors();
 $("confirmMultiBtn").disabled=multiSelected.size<1
}
function toggleMulti(id){
 if(multiSelected.has(id)){
  if(multiSelected.size===1){toast("Minimal pilih 1 kartu.");return}
  multiSelected.delete(id)
 }else multiSelected.add(id);
 const selected=multiCandidates.filter(c=>multiSelected.has(c.card_id));
 if(!selected.some(c=>c.card_id===multiFinalCardId)){
  const fallback=selected[0];multiFinalCardId=fallback.card_id;multiFinalColor=fallback.color||multiFinalColor
 }
 renderMultiAction()
}
function renderFinalColors(){
 const selected=multiCandidates.filter(c=>multiSelected.has(c.card_id));
 const wild=multiAnchor?.kind==="wild"||multiAnchor?.kind==="wild4";
 const colors=wild?["red","yellow","green","blue"]:[...new Set(selected.map(c=>c.color).filter(Boolean))];
 $("finalColorBox").classList.toggle("hidden",colors.length===0);
 $("finalColorOptions").innerHTML=colors.map(color=>`<button class="final-color-btn ${color} ${multiFinalColor===color?"active":""}" data-final-color="${color}">${colorName(color)}</button>`).join("");
 document.querySelectorAll("[data-final-color]").forEach(b=>b.onclick=()=>chooseFinalColor(b.dataset.finalColor))
}
function chooseFinalColor(color){
 multiFinalColor=color;
 if(!(multiAnchor.kind==="wild"||multiAnchor.kind==="wild4")){
  const card=multiCandidates.find(c=>multiSelected.has(c.card_id)&&c.color===color);
  if(card)multiFinalCardId=card.card_id
 }
 renderFinalColors()
}
async function confirmMulti(){
 if(actionBusy||multiSelected.size<1)return;
 const ids=[...multiSelected];
 const selected=multiCandidates.filter(c=>multiSelected.has(c.card_id));
 if(multiAnchor.kind==="number"&&multiAnchor.value===7&&room?.seven_zero){
  closeSheetOnly("multiActionModal");
  renderSwap(async target=>{await playCards(ids,multiFinalCardId,null,target)});
  openSheet("swapModal");return
 }
 const chosen=(multiAnchor.kind==="wild"||multiAnchor.kind==="wild4")?multiFinalColor:null;
 await playCards(ids,multiFinalCardId,chosen,null)
}
async function playCards(ids,finalId,color,target){
 if(actionBusy)return;
 closeSheets();setBusy(true);$("gameMessage").textContent="";
 try{
  const {data,error}=await db.rpc("color_clash_play_cards",{
   p_player_id:playerId,p_player_token:token,p_card_ids:ids,p_final_card_id:finalId,p_chosen_color:color,p_swap_target_id:target
  });
  if(error){$("gameMessage").textContent=friendlyError(error);return}
  pendingCard=null;await refreshGameState();renderTop();renderTurn();
  const n=Number(data?.played||ids.length);
  toast(n>1?`${n} kartu dibuang sekaligus ⚡`:"Kartu dimainkan")
 }finally{setBusy(false)}
}
function renderSwap(callback){
 $("swapPlayers").innerHTML=players.filter(p=>p.id!==playerId).map(p=>`<button class="swap-player" data-swap="${p.id}">${esc(p.player_name)} • ${p.card_count} kartu</button>`).join("");
 document.querySelectorAll("[data-swap]").forEach(b=>b.onclick=async()=>{multiSwapTarget=Number(b.dataset.swap);closeSheetOnly("swapModal");await callback(multiSwapTarget)})
}
function openSheet(id){$(id).classList.remove("hidden")}
function closeSheetOnly(id){$(id)?.classList.add("hidden")}
function closeSheets(){["colorModal","swapModal","helpModal","multiActionModal","gameMenuSheet","leaveGameModal"].forEach(id=>$(id)?.classList.add("hidden"))}

async function callUno(){
 if(actionBusy)return;setBusy(true,$("unoBtn"));
 try{const {error}=await db.rpc("color_clash_call_uno",{p_player_id:playerId,p_player_token:token});if(error)$("gameMessage").textContent=friendlyError(error);else toast("UNO! 📣")}
 finally{setBusy(false,$("unoBtn"))}
}
async function catchUno(){
 if(actionBusy)return;setBusy(true,$("catchBtn"));
 try{const {error}=await db.rpc("color_clash_catch_uno",{p_player_id:playerId,p_player_token:token});if(error)$("gameMessage").textContent=friendlyError(error);else toast("Tertangkap! +2 kartu")}
 finally{setBusy(false,$("catchBtn"))}
}
async function accept4(){
 if(actionBusy)return;setBusy(true,$("acceptWild4Btn"));
 const amount=Number(room?.challenge_amount||4);
 try{
  const {error}=await db.rpc("color_clash_accept_wild4",{p_player_id:playerId,p_player_token:token});
  if(error)$("gameMessage").textContent=friendlyError(error);else showDrawNotice(amount,{penalty:true,title:`+${amount} KARTU`})
 }finally{setBusy(false,$("acceptWild4Btn"))}
}
async function challengeWild4(){
 if(actionBusy)return;setBusy(true,$("challengeWild4Btn"));
 const amount=Number(room?.challenge_amount||4);
 try{
  const {data,error}=await db.rpc("color_clash_challenge_wild4",{p_player_id:playerId,p_player_token:token});
  if(error){$("gameMessage").textContent=friendlyError(error);return}
  if(data==="challenge_success")toast(`Challenge berhasil! Lawan mengambil ${amount}.`);
  else if(data==="winner")toast("Challenge selesai.");
  else{showDrawNotice(amount+2,{penalty:true,title:`+${amount+2} KARTU`});toast("Challenge gagal.")}
 }finally{setBusy(false,$("challengeWild4Btn"))}
}
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
$("unoAddBotBtn").onclick=()=>addUnoBots(1);$("unoAdd5BotBtn").onclick=()=>addUnoBots(5);$("unoRemoveBotsBtn").onclick=removeUnoBots;
$("unoBotSpeed").onchange=e=>localStorage.setItem("gameAlpiUnoBotSpeed",e.target.value);
if(localStorage.getItem("gameAlpiUnoBotSpeed"))$("unoBotSpeed").value=localStorage.getItem("gameAlpiUnoBotSpeed");
$("roomCodeInput").oninput=()=>$("roomCodeInput").value=normCode($("roomCodeInput").value);
$("startGameBtn").onclick=startGame;$("leaveRoomBtn").onclick=leave;$("drawBtn").onclick=drawCard;
$("unoBtn").onclick=callUno;$("catchBtn").onclick=catchUno;$("acceptWild4Btn").onclick=accept4;$("challengeWild4Btn").onclick=challengeWild4;$("backLobbyBtn").onclick=backLobby;
$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="✓";setTimeout(()=>$("copyCodeBtn").textContent="Salin",900)}catch{}};
$("showQrBtn").onclick=()=>{$("qrPanel").classList.toggle("hidden");if(!$("qrPanel").classList.contains("hidden")){const b=$("qrcode");b.innerHTML="";if(window.QRCode)new QRCode(b,{text:joinUrl(),width:160,height:160,correctLevel:QRCode.CorrectLevel.M})}};
document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{
 const c=pendingCard;if(!c)return;
 if(c.kind==="number"&&c.value===7&&room?.seven_zero){multiFinalColor=b.dataset.color;return}
 playCards([c.card_id],c.card_id,b.dataset.color,null)
});
document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeSheets);
$("closeHelpBtn").onclick=closeSheets;
$("selectAllMultiBtn").onclick=()=>{
 if(multiSelected.size===multiCandidates.length){multiSelected=new Set([multiAnchor.card_id]);multiFinalCardId=multiAnchor.card_id;multiFinalColor=multiAnchor.color||multiFinalColor}
 else multiSelected=new Set(multiCandidates.map(c=>c.card_id));
 renderMultiAction()
};
$("cancelMultiBtn").onclick=closeSheets;$("confirmMultiBtn").onclick=confirmMulti;
$("gameMenuBtn").onclick=()=>openSheet("gameMenuSheet");
$("closeGameMenuBtn").onclick=()=>closeSheetOnly("gameMenuSheet");
$("menuLeaveBtn").onclick=()=>{closeSheetOnly("gameMenuSheet");openSheet("leaveGameModal")};
$("cancelLeaveGameBtn").onclick=()=>closeSheetOnly("leaveGameModal");
$("confirmLeaveGameBtn").onclick=async()=>{closeSheetOnly("leaveGameModal");await leave()};

function initHelpTips(){
 const pop=$("helpPopover");
 document.querySelectorAll(".help").forEach(b=>{
  const open=()=>{pop.textContent=b.dataset.help||"";pop.classList.remove("hidden");const r=b.getBoundingClientRect();const w=Math.min(280,innerWidth-24);let left=Math.max(12,Math.min(r.left+r.width/2-w/2,innerWidth-w-12));let top=r.bottom+6;if(top+pop.offsetHeight>innerHeight-12)top=Math.max(12,r.top-pop.offsetHeight-6);pop.style.left=left+"px";pop.style.top=top+"px"};
  b.onmouseenter=open;b.onfocus=open;b.onclick=e=>{e.preventDefault();e.stopPropagation();pop.classList.contains("hidden")?open():pop.classList.add("hidden")}
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
 function render(){slides.forEach((s,i)=>s.classList.toggle("hidden",i!==step));stepText.textContent=`${step+1} / ${slides.length}`;dots.innerHTML=slides.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("");next.textContent=step===slides.length-1?"Mulai Main":"Lanjut"}
 function open(){step=0;render();modal.classList.remove("hidden")}
 function shut(){modal.classList.add("hidden");localStorage.setItem(UNO_TUTORIAL_KEY,"1")}
 next.onclick=()=>{if(step<slides.length-1){step++;render()}else shut()};close.onclick=shut;modal.addEventListener("click",e=>{if(e.target===modal)shut()});
 $("howToPlayBtn").onclick=open;$("lobbyHelpBtn").onclick=open;$("menuHelpBtn").onclick=()=>{closeSheetOnly("gameMenuSheet");open()};
 if(localStorage.getItem(UNO_TUTORIAL_KEY)!=="1")setTimeout(open,300)
}
initUnoTutorial();

window.addEventListener("online",async()=>{setConnection(false,"Menyambung...");if(roomCode){await refreshGameState();await subscribe();await safeRoute()}});
window.addEventListener("offline",()=>setConnection(false,"Offline"));
document.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible"&&roomCode){await refreshGameState();await safeRoute()}});

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
