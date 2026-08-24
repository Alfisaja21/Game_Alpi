const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id), STORE="gameAlpiWerewolfV1";
let roomCode=null,playerId=null,token=null,playerName=null,isHost=false,room=null,players=[],roleInfo=null;
let roomCh=null,playerCh=null,timer=null,actionBusy=false,timeoutBusy=false;
let wwBotTokens=new Map(),wwBotTimer=null,wwBotBusy=false;

const ROLE_META={
 wolf:{name:"Werewolf",icon:"🐺",desc:"Pilih korban setiap malam dan menyamar saat diskusi. Werewolf mengetahui anggota Werewolf lain."},
 villager:{name:"Warga",icon:"👨‍🌾",desc:"Tidak memiliki aksi malam. Cari Werewolf melalui diskusi dan voting."},
 seer:{name:"Seer / Peramal",icon:"🔮",desc:"Setiap malam cek satu pemain untuk mengetahui apakah dia Werewolf."},
 doctor:{name:"Doctor",icon:"🩺",desc:"Setiap malam lindungi satu pemain dari serangan Werewolf. Kamu boleh melindungi diri sendiri."}
};
let lastNarratedPhase=null;
const WW_AUDIO={night:'audio/night.mp3',morning:'audio/morning.mp3',wolf:'audio/wolf.mp3',vote:'audio/vote.mp3'};
function playWWAudio(key){const a=$("wwNarratorAudio");if(!a||!WW_AUDIO[key])return;a.src=WW_AUDIO[key];a.currentTime=0;a.play().catch(()=>{})}
function horrorNarration(text,audio,phase){if(phase&&lastNarratedPhase===phase)return;if(phase)lastNarratedPhase=phase;const o=$("horrorOverlay"),t=$("horrorText");if(!o||!t)return;t.textContent=text;o.classList.remove("hidden");clearTimeout(o._hideTimer);o._hideTimer=setTimeout(()=>o.classList.add("hidden"),2600);if(audio)playWWAudio(audio)}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function normName(v){return v.trim().replace(/\s+/g," ").slice(0,20)}
function normCode(v){return v.replace(/\D/g,"").slice(0,6)}
function save(){localStorage.setItem(STORE,JSON.stringify({roomCode,playerId,token,playerName,isHost}))}
function clear(){localStorage.removeItem(STORE)}
function show(id){["introScreen","setupScreen","lobbyScreen","gameScreen","finishScreen"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function openSheet(id){$(id).classList.remove("hidden")} function closeSheets(){document.querySelectorAll(".sheet").forEach(x=>x.classList.add("hidden"))}
function msg(id,text){$(id).textContent=text||""}
function friendly(e){const s=String(e?.message||e||"Terjadi kesalahan");if(/schema cache|not find the function/i.test(s))return"Database Werewolf belum memakai SQL V1.";return s}
let nightNoticeTimer=null;
function showNightNotice(text,secret=false){
 let el=document.getElementById("nightActionNotice");
 if(!el){el=document.createElement("div");el.id="nightActionNotice";el.className="night-notice";document.body.appendChild(el)}
 el.textContent=text;el.classList.toggle("secret",secret);el.classList.add("show");
 clearTimeout(nightNoticeTimer);nightNoticeTimer=setTimeout(()=>el.classList.remove("show"),3600)
}

async function loadRoom(){const {data}=await db.from("werewolf_rooms").select("*").eq("room_code",roomCode).maybeSingle();room=data;return data}
async function loadPlayers(){const {data}=await db.from("werewolf_players").select("*").eq("room_code",roomCode).order("seat_order");players=data||[];const me=players.find(p=>p.id===playerId);if(me){isHost=!!me.is_host;save()}if(isHost)await refreshWwBotTokens();maybeScheduleWwBots();return players}
async function loadRole(){if(!playerId)return;const {data,error}=await db.rpc("werewolf_get_my_role",{p_player_id:playerId,p_player_token:token});if(!error&&data?.length)roleInfo=data[0]}
function me(){return players.find(p=>p.id===playerId)}
function pname(id){return players.find(p=>p.id===id)?.player_name||"pemain"}
function phaseLabel(ph){return({night_wolf:"Malam • Werewolf",night_seer:"Malam • Seer",night_doctor:"Malam • Doctor",day_result:"Pagi",discussion:"Diskusi",voting:"Voting",vote_result:"Hasil Voting",finished:"Selesai"})[ph]||"Werewolf"}


function wwBotDelay(){return Number($("wwBotSpeed")?.value||localStorage.getItem("gameAlpiWwBotSpeed")||600)}
async function refreshWwBotTokens(){
 if(!isHost||!roomCode)return;
 const {data,error}=await db.rpc("werewolf_get_bot_sessions",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});
 if(error)return;
 wwBotTokens=new Map((data||[]).map(x=>[Number(x.player_id),x.player_token]))
}
async function addWwBots(count){
 const {error}=await db.rpc("werewolf_add_bots",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_count:count});
 if(error){msg("lobbyMessage",friendly(error));return}
 await loadPlayers();await refreshWwBotTokens();renderLobby()
}
async function removeWwBots(){
 const {error}=await db.rpc("werewolf_remove_bots",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});
 if(error){msg("lobbyMessage",friendly(error));return}
 await loadPlayers();await refreshWwBotTokens();renderLobby()
}
function maybeScheduleWwBots(){
 if(!isHost||wwBotBusy||wwBotTimer||!room||!roomCode)return;
 if(!["night_wolf","night_seer","night_doctor","voting"].includes(room.phase))return;
 const bots=players.filter(p=>p.is_bot&&p.is_alive);
 if(!bots.length)return;
 wwBotTimer=setTimeout(async()=>{wwBotTimer=null;await runWwBots()},wwBotDelay())
}
async function getWwBotRole(botId,bt){
 const {data,error}=await db.rpc("werewolf_get_my_role",{p_player_id:botId,p_player_token:bt});
 return error?null:(data?.[0]||null)
}
async function runWwBots(){
 if(wwBotBusy)return;wwBotBusy=true;
 try{
   await loadPlayers();if(!wwBotTokens.size)await refreshWwBotTokens();
   const bots=players.filter(p=>p.is_bot&&p.is_alive);
   if(room.phase==="voting"){
     for(const bot of bots){
       const bt=wwBotTokens.get(Number(bot.id));if(!bt)continue;
       const targets=players.filter(p=>p.is_alive&&Number(p.id)!==Number(bot.id));
       if(!targets.length)continue;
       const target=targets[Math.floor(Math.random()*targets.length)];
       const {error}=await db.rpc("werewolf_vote",{p_player_id:bot.id,p_player_token:bt,p_target_id:target.id});
       if(error&&!/sudah|duplicate|voting/i.test(error.message||""))console.warn(error)
     }
     return
   }

   for(const bot of bots){
     const bt=wwBotTokens.get(Number(bot.id));if(!bt)continue;
     const role=await getWwBotRole(bot.id,bt);if(!role)continue;
     let should=false,targets=[];
     if(room.phase==="night_wolf"&&role.role==="wolf"){
       should=true;const wolves=new Set((role.wolf_ids||[]).map(Number));targets=players.filter(p=>p.is_alive&&!wolves.has(Number(p.id)))
     }else if(room.phase==="night_seer"&&role.role==="seer"){
       should=true;targets=players.filter(p=>p.is_alive&&Number(p.id)!==Number(bot.id))
     }else if(room.phase==="night_doctor"&&role.role==="doctor"){
       should=true;targets=players.filter(p=>p.is_alive)
     }
     if(!should||!targets.length)continue;
     const target=targets[Math.floor(Math.random()*targets.length)];
     const {error}=await db.rpc("werewolf_night_action",{p_player_id:bot.id,p_player_token:bt,p_target_id:target.id});
     if(error&&!/giliran|aksi|duplicate/i.test(error.message||""))console.warn(error)
   }
 }finally{
   wwBotBusy=false;setTimeout(()=>maybeScheduleWwBots(),120)
 }
}

function renderLobby(){
 $("roomCodeDisplay").textContent=roomCode;$("playerCount").textContent=`${players.length} / 20`;
 $("playersList").innerHTML=players.map(p=>`<div class="player"><div class="player-main"><div class="avatar">${esc(p.player_name[0])}</div><div><b>${esc(p.player_name)}${p.is_bot?'<span class="bot-badge">BOT</span>':""}</b><small>${p.is_host?"HOST":p.is_bot?"BOT • Test":"Pemain "+p.seat_order}</small></div></div>${isHost&&!p.is_host?`<button class="kick" data-kick="${p.id}">Kick</button>`:""}</div>`).join("");
 document.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>kick(Number(b.dataset.kick)));
 $("hostPanel").classList.toggle("hidden",!isHost);$("startGameBtn").disabled=players.length<5
}
function renderAlive(){
 $("aliveSummary").innerHTML=players.map(p=>`<span class="alive-pill ${p.is_alive?"":"dead"}">${p.is_alive?"●":"✕"} ${esc(p.player_name)}${p.is_bot?" 🤖":""}</span>`).join("");
 $("deadPanel").classList.toggle("hidden",me()?.is_alive!==false)
}
function targetButtons(filterFn,callback,label="Pilih"){
 const list=players.filter(p=>p.is_alive&&filterFn(p));
 return list.map(p=>`<button class="target-btn" data-target="${p.id}">${esc(p.player_name)}<small>${label}</small></button>`).join("")
}
async function submitNight(targetId){
 if(actionBusy)return;actionBusy=true;
 const roleAtAction=roleInfo?.role;
 const targetName=pname(targetId);
 const {data,error}=await db.rpc("werewolf_night_action",{p_player_id:playerId,p_player_token:token,p_target_id:targetId});
 if(error)alert(friendly(error));else{
  document.querySelectorAll("[data-target]").forEach(b=>{b.disabled=true;b.classList.toggle("selected",Number(b.dataset.target)===targetId)});
  if(data?.seer_result){
   const text=data.seer_result==="wolf"?`🔮 ${targetName} adalah WEREWOLF.`:`🔮 ${targetName} bukan Werewolf.`;
   $("seerResult").classList.remove("hidden");$("seerResult").textContent=text;showNightNotice(text,true)
  }else if(roleAtAction==="wolf"){
   showNightNotice(`🐺 Pilihan Werewolf untuk ${targetName} sudah tersimpan.`)
  }else if(roleAtAction==="doctor"){
   showNightNotice(`🩺 Perlindungan untuk ${targetName} sudah tersimpan.`)
  }
 }
 actionBusy=false
}
function renderNight(){
 $("nightPanel").classList.remove("hidden");const ph=room.phase, alive=me()?.is_alive!==false;
 $("nightTargets").innerHTML="";$("seerResult").classList.add("hidden");
 if(!alive){$("nightIcon").textContent="👻";$("nightHeading").textContent="Kamu hanya menonton";$("nightText").textContent="Tunggu fase malam selesai.";return}
 const role=roleInfo?.role;
 if(ph==="night_wolf"&&role==="wolf"){
  $("nightIcon").textContent="🐺";$("nightHeading").textContent="Werewolf memilih korban";$("nightText").textContent="Pilih satu pemain non-Werewolf.";
  const wolves=new Set(roleInfo.wolf_ids||[]);$("nightTargets").innerHTML=targetButtons(p=>!wolves.has(p.id),submitNight,"Jadikan korban");
 }else if(ph==="night_seer"&&role==="seer"){
  $("nightIcon").textContent="🔮";$("nightHeading").textContent="Periksa satu pemain";$("nightText").textContent="Hasil hanya terlihat di HP-mu.";
  $("nightTargets").innerHTML=targetButtons(p=>p.id!==playerId,submitNight,"Periksa role");
 }else if(ph==="night_doctor"&&role==="doctor"){
  $("nightIcon").textContent="🩺";$("nightHeading").textContent="Lindungi satu pemain";$("nightText").textContent="Pilih siapa yang ingin diselamatkan malam ini.";
  $("nightTargets").innerHTML=targetButtons(()=>true,submitNight,"Lindungi");
 }else{
  $("nightIcon").textContent="🌙";$("nightHeading").textContent="Malam berlangsung";$("nightText").textContent="Role lain sedang melakukan aksi rahasianya."
 }
 document.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>submitNight(Number(b.dataset.target)))
}
function renderDay(){
 $("dayResultPanel").classList.remove("hidden");
 $("dayResult").textContent=room.day_victim_id?`😵 ${pname(room.day_victim_id)} ditemukan tersingkir pagi ini. Role-nya tetap rahasia.`:"🛡️ Tidak ada korban malam ini."
}
function renderDiscussion(){
 $("discussionPanel").classList.remove("hidden");$("discussionPlayers").innerHTML=players.filter(p=>p.is_alive).map(p=>`<span>💬 ${esc(p.player_name)}</span>`).join("");
 $("startVoteBtn").classList.toggle("hidden",!isHost);$("startVoteBtn").onclick=startVoting
}
function renderVoting(){
 $("votingPanel").classList.remove("hidden");
 if(me()?.is_alive===false){$("voteHint").textContent="Kamu sudah mati dan tidak dapat voting.";$("voteTargets").innerHTML="";return}
 $("voteHint").textContent="Pilih satu pemain. Setelah dikirim, suara tidak dapat diganti.";
 $("voteTargets").innerHTML=targetButtons(p=>p.id!==playerId,submitVote,"Vote");
 document.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>submitVote(Number(b.dataset.target)))
}
function renderVoteResult(){
 $("voteResultPanel").classList.remove("hidden");
 $("voteResult").textContent=room.vote_eliminated_id?`⚖️ ${pname(room.vote_eliminated_id)} mendapat suara terbanyak dan tersingkir. Role tetap rahasia.`:"🤝 Voting seri / tidak cukup suara. Tidak ada pemain yang tersingkir."
}
async function renderGame(){
 if(room?.phase==="night_wolf")horrorNarration("Malam telah tiba. Werewolf mulai mencari mangsa.","wolf","night_wolf");
 else if(room?.phase==="day_result")horrorNarration("Matahari terbit. Warga melihat apa yang terjadi malam ini.","morning","day_result");
 else if(room?.phase==="discussion")horrorNarration("Waktu diskusi dimulai. Tentukan siapa yang mencurigakan.",null,"discussion");
 else if(room?.phase==="voting")horrorNarration("Waktunya menentukan pilihan. Pilih pemain yang paling mencurigakan.","vote","voting");

 show("gameScreen");await loadPlayers();await loadRole();renderAlive();
 $("gameRoomCode").textContent=roomCode;$("roundText").textContent=`RONDE ${room.round_no}`;$("phaseTitle").textContent=phaseLabel(room.phase);
 document.querySelectorAll(".game-panel").forEach(x=>x.classList.add("hidden"));
 const instructions={night_wolf:"Werewolf sedang memilih korban.",night_seer:"Seer mendapat kesempatan memeriksa pemain.",night_doctor:"Doctor memilih pemain yang dilindungi.",day_result:"Lihat apa yang terjadi semalam.",discussion:"Diskusikan siapa yang paling mencurigakan.",voting:"Saatnya menentukan pilihan.",vote_result:"Lihat hasil voting."};
 $("phaseInstruction").textContent=instructions[room.phase]||"";
 if(room.phase.startsWith("night_"))renderNight();else if(room.phase==="day_result")renderDay();else if(room.phase==="discussion")renderDiscussion();else if(room.phase==="voting")renderVoting();else if(room.phase==="vote_result")renderVoteResult();
 startTimer();maybeScheduleWwBots()
}
async function renderFinish(){
 show("finishScreen");await loadPlayers();const town=room.winner==="town";
 $("finishIcon").textContent=town?"👥":"🐺";$("winnerTitle").textContent=town?"Warga Menang!":"Werewolf Menang!";
 $("winnerText").textContent=town?"Semua Werewolf berhasil ditemukan.":"Werewolf telah menyamai atau melebihi jumlah pemain lain.";
 const {data}=await db.rpc("werewolf_reveal_roles",{p_room_code:roomCode,p_player_id:playerId,p_player_token:token});
 $("roleRevealList").innerHTML=(data||[]).map(x=>`<div class="reveal-row"><span>${esc(x.player_name)}</span><b>${ROLE_META[x.role]?.icon||""} ${ROLE_META[x.role]?.name||x.role}</b></div>`).join("");
 $("backLobbyBtn").classList.toggle("hidden",!isHost);$("finishHint").classList.toggle("hidden",isHost)
}
async function route(){if(!room)return;if(room.phase==="lobby"){show("lobbyScreen");await loadPlayers();renderLobby()}else if(room.phase==="finished")await renderFinish();else await renderGame()}

async function subscribe(){
 if(roomCh)await db.removeChannel(roomCh);if(playerCh)await db.removeChannel(playerCh);
 roomCh=db.channel(`ww-room-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"werewolf_rooms",filter:`room_code=eq.${roomCode}`},async p=>{if(p.eventType==="DELETE"){leaveLocal("Room sudah ditutup.");return}room=p.new;await route()}).subscribe();
 playerCh=db.channel(`ww-players-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"werewolf_players",filter:`room_code=eq.${roomCode}`},async()=>{await loadPlayers();if(room?.phase==="lobby")renderLobby();else renderAlive()}).subscribe()
}
async function enter(){save();await loadRoom();if(!room){leaveLocal("Room tidak ditemukan.");return}await subscribe();await route()}
async function createRoom(){const n=normName($("playerName").value);if(!n){msg("setupMessage","Masukkan nama.");return}const {data,error}=await db.rpc("werewolf_create_room",{p_player_name:n});if(error){msg("setupMessage",friendly(error));return}const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=true;await enter()}
async function joinRoom(){const n=normName($("playerName").value),c=normCode($("roomCodeInput").value);if(!n||c.length!==6){msg("setupMessage","Isi nama dan kode room 6 angka.");return}const {data,error}=await db.rpc("werewolf_join_room",{p_room_code:c,p_player_name:n});if(error){msg("setupMessage",friendly(error));return}const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=false;await enter()}
async function kick(id){const {error}=await db.rpc("werewolf_kick_player",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_target_id:id});if(error)msg("lobbyMessage",friendly(error))}
async function startGame(){const {error}=await db.rpc("werewolf_start_game",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});if(error)msg("lobbyMessage",friendly(error))}
async function startVoting(){await db.rpc("werewolf_start_voting",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token})}
async function submitVote(id){if(actionBusy)return;actionBusy=true;const {error}=await db.rpc("werewolf_vote",{p_player_id:playerId,p_player_token:token,p_target_id:id});if(error)alert(friendly(error));else document.querySelectorAll("[data-target]").forEach(b=>{b.disabled=true;b.classList.toggle("selected",Number(b.dataset.target)===id)});actionBusy=false}
async function timeoutPhase(){if(timeoutBusy)return;timeoutBusy=true;await db.rpc("werewolf_timeout_phase",{p_room_code:roomCode});setTimeout(()=>timeoutBusy=false,800)}
function startTimer(){if(timer)clearInterval(timer);const tick=async()=>{if(!room?.phase_started_at||!room?.phase_seconds){$("phaseTimer").textContent="∞";return}const end=new Date(room.phase_started_at).getTime()+room.phase_seconds*1000,left=Math.max(0,Math.ceil((end-Date.now())/1000));$("phaseTimer").textContent=`${left}s`;$("phaseTimer").classList.toggle("warn",left<=10);$("phaseTimer").classList.toggle("danger",left<=5);if(left<=0)await timeoutPhase()};tick();timer=setInterval(tick,500)}
async function leave(){const {error}=await db.rpc("werewolf_leave_room",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error));else leaveLocal("")}
async function leaveLocal(text){if(roomCh)await db.removeChannel(roomCh);if(playerCh)await db.removeChannel(playerCh);clear();roomCode=playerId=token=playerName=null;room=null;players=[];roleInfo=null;show("setupScreen");msg("setupMessage",text)}
async function backLobby(){const {error}=await db.rpc("werewolf_reset_lobby",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});if(error)alert(friendly(error))}
function showRole(){if(!roleInfo)return;const m=ROLE_META[roleInfo.role];$("myRoleIcon").textContent=m.icon;$("myRoleName").textContent=m.name;$("myRoleDesc").textContent=m.desc;const names=roleInfo.wolf_names||[];$("wolfFriends").classList.toggle("hidden",roleInfo.role!=="wolf");$("wolfFriends").textContent=names.length?`🐺 Werewolf lain: ${names.join(", ")}`:"🐺 Kamu satu-satunya Werewolf.";openSheet("roleModal")}

$("continueBtn").onclick=()=>show("setupScreen");document.querySelectorAll("[data-back-intro]").forEach(b=>b.onclick=()=>show("introScreen"));
$("openRolesBtn").onclick=()=>openSheet("rolesHelpModal");$("lobbyHelpBtn").onclick=()=>openSheet("rolesHelpModal");$("menuRulesBtn").onclick=()=>{closeSheets();openSheet("rolesHelpModal")};
document.querySelectorAll("[data-close-sheet]").forEach(b=>b.onclick=closeSheets);$("closeRoleBtn").onclick=closeSheets;
$("createRoomBtn").onclick=createRoom;$("joinRoomBtn").onclick=joinRoom;$("roomCodeInput").oninput=()=>$("roomCodeInput").value=normCode($("roomCodeInput").value);
$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="✓";setTimeout(()=>$("copyCodeBtn").textContent="Salin",800)}catch{}};
$("wwAddBotBtn").onclick=()=>addWwBots(1);$("wwAdd5BotBtn").onclick=()=>addWwBots(5);$("wwRemoveBotsBtn").onclick=removeWwBots;$("wwBotSpeed").onchange=e=>localStorage.setItem("gameAlpiWwBotSpeed",e.target.value);if(localStorage.getItem("gameAlpiWwBotSpeed"))$("wwBotSpeed").value=localStorage.getItem("gameAlpiWwBotSpeed");
$("startGameBtn").onclick=startGame;$("leaveLobbyBtn").onclick=leave;$("roleBtn").onclick=showRole;$("gameMenuBtn").onclick=()=>openSheet("menuSheet");$("leaveGameBtn").onclick=()=>{if(confirm("Benar-benar keluar dari Werewolf?"))leave()};$("backLobbyBtn").onclick=backLobby;

(async function boot(){const raw=localStorage.getItem(STORE);if(raw){try{const x=JSON.parse(raw);roomCode=x.roomCode;playerId=x.playerId;token=x.token;playerName=x.playerName;isHost=x.isHost;if(roomCode&&playerId&&token){await enter();return}}catch{clear()}}const q=new URLSearchParams(location.search).get("room");if(q){$("roomCodeInput").value=normCode(q);show("setupScreen")}})();