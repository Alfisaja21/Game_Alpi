const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id), STORE="gameAlpiWerewolfV1", SOUND_KEY="gameAlpiWerewolfSound", VOICE_VOLUME_KEY="gameAlpiWerewolfVoiceVolume";
let roomCode=null,playerId=null,token=null,playerName=null,isHost=false,room=null,players=[],roleInfo=null;
let roomCh=null,playerCh=null,timer=null,actionBusy=false,timeoutBusy=false;
let wwBotTokens=new Map(),wwBotTimer=null,wwBotBusy=false;
let soundEnabled=localStorage.getItem(SOUND_KEY)!=="0",lastNarrationKey=null,roleHoldTimer=null,roleRevealed=false,audioUnlocked=false;
let voiceVolume=Math.max(.2,Math.min(1,Number(localStorage.getItem(VOICE_VOLUME_KEY)||.85)));
let voiceRunId=0,voiceSequenceKey=null,playedNarrationKeys=new Set(),startingGame=false;

const ROLE_META={
 wolf:{name:"Werewolf",icon:"🐺",desc:"Pilih korban setiap malam dan menyamar saat diskusi. Werewolf mengetahui anggota Werewolf lain."},
 villager:{name:"Warga",icon:"👨‍🌾",desc:"Tidak memiliki aksi malam. Cari Werewolf melalui diskusi dan voting."},
 seer:{name:"Seer / Peramal",icon:"🔮",desc:"Setiap malam cek satu pemain untuk mengetahui apakah dia Werewolf."},
 doctor:{name:"Doctor",icon:"🩺",desc:"Setiap malam lindungi satu pemain dari serangan Werewolf. Kamu boleh melindungi diri sendiri."}
};

const WW_SFX={
 night:"audio/ambience-night.mp3",
 howl:"audio/howl.mp3",
 morning:"audio/morning.mp3",
 vote:"audio/vote.mp3",
 role:"audio/role-reveal.mp3",
 death:"audio/death.mp3"
};

/*
 Spoken narrator files are intentionally separate from SFX.
 Put human-recorded Indonesian MP3 files in werewolf/audio/narrator/.
 The game will use them automatically when present.
*/
const WW_VOICE={
 gameStart:"audio/narrator/game-start.mp3",
 roleReveal:"audio/narrator/role-reveal.mp3",
 nightStart:"audio/narrator/night-start.mp3",
 wolfWake:"audio/narrator/wolf-wake.mp3",
 seerWake:"audio/narrator/seer-wake.mp3",
 doctorWake:"audio/narrator/doctor-wake.mp3",
 morningDeath:"audio/narrator/morning-death.mp3",
 discussionStart:"audio/narrator/discussion-start.mp3",
 votingStart:"audio/narrator/voting-start.mp3",
 townWin:"audio/narrator/town-win.mp3",
 wolfWin:"audio/narrator/wolf-win.mp3"
};

function hostAudioOn(){return !!isHost&&soundEnabled}
function clampVoiceVolume(v){return Math.max(.2,Math.min(1,Number(v)||.85))}
function applyVoiceVolume(){
 voiceVolume=clampVoiceVolume(voiceVolume);
 const a=$("wwNarratorAudio"),p=$("wwPrivateAudio");
 if(a)a.volume=voiceVolume;
 if(p)p.volume=Math.min(.82,voiceVolume);
 if($("narratorVolume"))$("narratorVolume").value=String(Math.round(voiceVolume*100));
 if($("narratorVolumeText"))$("narratorVolumeText").textContent=`${Math.round(voiceVolume*100)}%`
}
function setVoiceVolume(percent){
 voiceVolume=clampVoiceVolume(Number(percent)/100);
 localStorage.setItem(VOICE_VOLUME_KEY,String(voiceVolume));
 applyVoiceVolume();updateSoundUi()
}
function unlockAudio(){
 if(audioUnlocked||!soundEnabled)return;
 const a=isHost?$("wwNarratorAudio"):$("wwPrivateAudio");if(!a)return;
 const src=isHost?WW_VOICE.nightStart:WW_VOICE.roleReveal;
 const oldVol=a.volume;a.src=src;a.volume=0;
 const promise=a.play();
 if(promise?.then)promise.then(()=>{a.pause();a.currentTime=0;a.volume=oldVol||voiceVolume;audioUnlocked=true}).catch(()=>{a.volume=oldVol||voiceVolume})
}
function setWave(on){
 $("voiceWave")?.classList.toggle("active",!!on);
 $("moderatorBox")?.classList.toggle("speaking",!!on)
}
function duckAmbience(on){
 const a=$("wwAmbienceAudio");if(!a||a.paused)return;
 a.volume=on?.07:.18
}
function stopNarrator(){
 voiceRunId++;voiceSequenceKey=null;
 const a=$("wwNarratorAudio");if(a){a.pause();a.currentTime=0;a.onended=null;a.onerror=null;a.onabort=null;a.onplay=null}
 setWave(false);duckAmbience(false);
 document.querySelector(".moderator-lobby")?.classList.remove("testing");
 $("testNarratorBtn")?.classList.remove("is-playing")
}
function playSfx(key,volume=.75,hostOnly=true){
 const src=WW_SFX[key],a=$("wwSfxAudio");
 if((hostOnly&&!hostAudioOn())||(!hostOnly&&!soundEnabled)||!src||!a)return;
 a.pause();a.src=src;a.volume=Math.max(0,Math.min(1,volume));a.currentTime=0;a.play().catch(()=>{})
}
function setNightAmbience(on){
 const a=$("wwAmbienceAudio");if(!a)return;
 if(on&&hostAudioOn()){
   if(!a.src||!a.src.includes("ambience-night.mp3"))a.src=WW_SFX.night;
   a.volume=.18;a.play().catch(()=>{})
 }else{a.pause();a.currentTime=0}
}
function playNarratorClip(voiceKey,runId=voiceRunId){
 return new Promise(resolve=>{
   const src=WW_VOICE[voiceKey],a=$("wwNarratorAudio");
   if(!hostAudioOn()||!src||!a||runId!==voiceRunId){resolve(false);return}
   a.pause();a.src=src;a.volume=voiceVolume;a.currentTime=0;
   let done=false;
   const finish=ok=>{if(done)return;done=true;a.onended=null;a.onerror=null;a.onabort=null;if(runId===voiceRunId){setWave(false);duckAmbience(false)}resolve(ok)};
   a.onplay=()=>{if(runId===voiceRunId){audioUnlocked=true;setWave(true);duckAmbience(true)}};
   a.onended=()=>finish(true);a.onerror=()=>finish(false);a.onabort=()=>finish(false);
   const p=a.play();if(p?.catch)p.catch(()=>finish(false))
 })
}
function waitVoice(ms,runId){return new Promise(resolve=>setTimeout(()=>resolve(runId===voiceRunId),ms))}
async function playVoiceSequence(sequenceKey,voiceKeys,gapMs=650){
 if(!hostAudioOn()||!voiceKeys?.length)return false;
 if(playedNarrationKeys.has(sequenceKey)||voiceSequenceKey===sequenceKey)return false;
 playedNarrationKeys.add(sequenceKey);
 stopNarrator();
 const runId=++voiceRunId;voiceSequenceKey=sequenceKey;
 for(let i=0;i<voiceKeys.length;i++){
   if(runId!==voiceRunId)break;
   await playNarratorClip(voiceKeys[i],runId);
   if(i<voiceKeys.length-1&&runId===voiceRunId)await waitVoice(gapMs,runId)
 }
 if(runId===voiceRunId){voiceSequenceKey=null;setWave(false);duckAmbience(false)}
 return true
}
async function playHostPreview(){
 if(!isHost){showNightNotice("🎙️ Test narrator hanya tersedia di HP Host.");return}
 if(!soundEnabled){
   soundEnabled=true;
   localStorage.setItem(SOUND_KEY,"1");
   updateSoundUi()
 }

 stopNarrator();

 // Tombol TEST NARATOR sudah merupakan user gesture,
 // jadi langsung putar audio tanpa unlockAudio() tambahan.
 const btn=$("testNarratorBtn"),box=document.querySelector(".moderator-lobby");
 btn?.classList.add("is-playing");
 box?.classList.add("testing");

 const runId=++voiceRunId;
 voiceSequenceKey="preview";
 await playNarratorClip("nightStart",runId);

 if(runId===voiceRunId){
   voiceSequenceKey=null;
   audioUnlocked=true;
   btn?.classList.remove("is-playing");
   box?.classList.remove("testing")
 }
}
function roleVoiceKey(){return`gameAlpiWerewolfRoleVoice:${roomCode||"room"}:${room?.match_no||0}:${playerId||0}`}
function playPrivateRoleNarrator(){
 if(!soundEnabled||!WW_VOICE.roleReveal)return;

 const key=roleVoiceKey();
 if(localStorage.getItem(key)==="1")return;

 const a=$("wwPrivateAudio");
 if(!a)return;

 a.pause();
 a.src=WW_VOICE.roleReveal;
 a.volume=Math.min(.82,voiceVolume);
 a.currentTime=0;

 const p=a.play();
 if(p?.then){
   p.then(()=>{
     // Baru tandai selesai dipicu setelah browser benar-benar mengizinkan play.
     localStorage.setItem(key,"1");
     audioUnlocked=true
   }).catch(()=>{
     // Jangan set key. Kalau browser menolak, pemain dapat mencoba lagi
     // saat membuka kartu role berikutnya.
   })
 }else{
   localStorage.setItem(key,"1");
   audioUnlocked=true
 }
}
function narrationData(){
 const ph=room?.phase;
 if(ph==="night_wolf")return{icon:"🌙",text:"Malam telah tiba. Semua warga menutup mata. Werewolf, bangun dan pilih mangsamu.",sfx:"howl",voices:["nightStart","wolfWake"]};
 if(ph==="night_seer")return{icon:"🔮",text:"Werewolf kembali tidur. Seer, buka mata dan periksa satu pemain.",voices:["seerWake"]};
 if(ph==="night_doctor")return{icon:"🩺",text:"Seer kembali tidur. Doctor, pilih satu orang untuk dilindungi malam ini.",voices:["doctorWake"]};
 if(ph==="day_result"&&room?.day_victim_id)return{icon:"☀️",text:`Pagi telah datang. ${pname(room.day_victim_id)} tidak selamat dari malam yang panjang.`,sfx:"death",voices:["morningDeath"]};
 if(ph==="day_result")return{icon:"☀️",text:"Matahari terbit. Malam ini tidak ada warga yang tersingkir.",sfx:"morning",voices:[]};
 if(ph==="discussion"){
   const starter=room?.discussion_speaker_id?pname(room.discussion_speaker_id):null;
   return{icon:"💬",text:starter?`Waktu diskusi dimulai. ${starter}, mulai sampaikan kecurigaanmu terlebih dahulu.`:"Waktu diskusi dimulai. Cari siapa yang paling mencurigakan.",voices:["discussionStart"]}
 }
 if(ph==="voting")return{icon:"🗳️",text:"Diskusi selesai. Sekarang tentukan pilihanmu. Satu suara dapat mengubah nasib desa.",sfx:"vote",voices:["votingStart"]};
 if(ph==="vote_result"&&room?.vote_eliminated_id)return{icon:"⚖️",text:`Keputusan telah dibuat. ${pname(room.vote_eliminated_id)} harus meninggalkan desa.`,sfx:"death",voices:[]};
 if(ph==="vote_result")return{icon:"⚖️",text:"Suara warga berakhir seri. Tidak ada seorang pun yang meninggalkan desa.",voices:[]};
 return null
}
function horrorNarration(force=false){
 const data=narrationData();if(!data)return;
 const key=`phase:${roomCode||""}:${room?.match_no||0}:${room?.round_no||0}:${room?.phase}:${room?.day_victim_id||0}:${room?.vote_eliminated_id||0}`;
 if(!force&&lastNarrationKey===key)return;
 lastNarrationKey=key;
 $("moderatorText").textContent=data.text;
 const o=$("horrorOverlay"),t=$("horrorText");if(o&&t){
   $("overlaySceneIcon").textContent=data.icon;t.textContent=data.text;
   $("horrorSubtext").textContent=isHost&&soundEnabled?"Moderator • Suara Host":"Moderator • Narasi teks";
   o.classList.remove("hidden");clearTimeout(o._hideTimer);o._hideTimer=setTimeout(()=>o.classList.add("hidden"),3000)
 }
 if(data.sfx)playSfx(data.sfx,data.sfx==="howl"?.52:.66);
 if(data.voices?.length)playVoiceSequence(key,data.voices,700)
}
function updateSoundUi(){
 const label=soundEnabled?"🔊":"🔇";
 if($("soundBtn")){$("soundBtn").textContent=isHost?label:"🎙️";$("soundBtn").classList.toggle("muted",!soundEnabled);$("soundBtn").title=isHost?(soundEnabled?"Matikan audio moderator":"Aktifkan audio moderator"):"Audio moderator utama diputar dari HP Host"}
 if($("lobbySoundBtn")){$("lobbySoundBtn").textContent=soundEnabled?"🔊 AUDIO ON":"🔇 AUDIO OFF";$("lobbySoundBtn").classList.toggle("off",!soundEnabled)}
 if($("menuSoundText"))$("menuSoundText").textContent=isHost?(soundEnabled?`Aktif • volume ${Math.round(voiceVolume*100)}%.`:"Audio moderator dimatikan."):"Audio moderator utama diputar dari HP Host.";
 applyVoiceVolume()
}
function toggleSound(){
 if(!isHost){showNightNotice("🎙️ Audio moderator utama diputar dari HP Host.");return}
 soundEnabled=!soundEnabled;localStorage.setItem(SOUND_KEY,soundEnabled?"1":"0");updateSoundUi();
 if(soundEnabled)unlockAudio();
 if(!soundEnabled){stopNarrator();$("wwSfxAudio")?.pause();setNightAmbience(false)}
 else if(room?.phase?.startsWith("night_"))setNightAmbience(true)
}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function normName(v){return v.trim().replace(/\s+/g," ").slice(0,20)}
function normCode(v){return v.replace(/\D/g,"").slice(0,6)}
function save(){localStorage.setItem(STORE,JSON.stringify({roomCode,playerId,token,playerName,isHost}))}
function clear(){localStorage.removeItem(STORE)}
function show(id){["introScreen","setupScreen","lobbyScreen","gameScreen","finishScreen"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function openSheet(id){$(id).classList.remove("hidden")}
function hideRoleCard(){clearTimeout(roleHoldTimer);roleRevealed=false;$("roleFlipCard")?.classList.remove("revealed");$("holdRoleBtn")?.classList.remove("holding")}
function closeSheets(){hideRoleCard();document.querySelectorAll(".sheet").forEach(x=>x.classList.add("hidden"))}
function msg(id,text){$(id).textContent=text||""}
function friendly(e){const s=String(e?.message||e||"Terjadi kesalahan");if(/schema cache|not find the function|match_no|discussion_speaker/i.test(s))return"Database Werewolf belum memakai patch V2 terbaru.";return s}
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

function phaseGroup(ph){if(ph?.startsWith("night_"))return"night";if(ph==="day_result"||ph==="vote_result")return"day";if(ph==="discussion")return"discussion";if(ph==="voting")return"voting";return null}
function updatePhaseTrail(){
 const g=phaseGroup(room?.phase);document.querySelectorAll("#phaseTrail [data-step]").forEach(el=>el.classList.toggle("active",el.dataset.step===g))
}
function updateScene(){
 const scene=$("villageScene");if(!scene)return;const night=room?.phase?.startsWith("night_");
 scene.classList.toggle("night",!!night);scene.classList.toggle("day",!night)
}
function roleSeenKey(){return`gameAlpiWwRoleSeen:${roomCode||""}:${room?.match_no||0}`}
function updateRoleAttention(){
 const seen=localStorage.getItem(roleSeenKey())==="1";$("roleBtn")?.classList.toggle("role-attention",!seen&&room?.phase!=="lobby"&&room?.phase!=="finished")
}
function setConnectionStatus(status){
 const b=$("connectionBadge");if(!b)return;
 const online=status==="SUBSCRIBED"||status==="ONLINE";
 b.classList.toggle("offline",!online);b.querySelector("span").textContent=online?"Online":"Menghubungkan..."
}



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
 $("hostPanel").classList.toggle("hidden",!isHost);$("startGameBtn").disabled=players.length<5;updateSoundUi();setNightAmbience(false)
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
 $("dayResult").innerHTML=room.day_victim_id?`<strong>😵 ${esc(pname(room.day_victim_id))}</strong><span>ditemukan tersingkir pagi ini.</span><small>Role tetap rahasia sampai game selesai.</small>`:`<strong>🛡️ Desa selamat malam ini</strong><span>Tidak ada korban. Seseorang mungkin berhasil dilindungi.</span>`
}
function renderDiscussion(){
 $("discussionPanel").classList.remove("hidden");$("discussionPlayers").innerHTML=players.filter(p=>p.is_alive).map(p=>`<span>💬 ${esc(p.player_name)}</span>`).join("");
 const starter=room?.discussion_speaker_id?pname(room.discussion_speaker_id):null;
 $("firstSpeakerCard").classList.toggle("hidden",!starter);if(starter)$("firstSpeakerName").textContent=starter;
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
 $("voteResult").innerHTML=room.vote_eliminated_id?`<strong>⚖️ ${esc(pname(room.vote_eliminated_id))}</strong><span>mendapat suara terbanyak dan harus meninggalkan desa.</span><small>Role tetap rahasia.</small>`:`<strong>🤝 Voting berakhir seri</strong><span>Tidak ada pemain yang tersingkir pada ronde ini.</span>`
}
async function renderGame(){
 show("gameScreen");await loadPlayers();await loadRole();renderAlive();
 $("gameRoomCode").textContent=roomCode;$("roundText").textContent=`RONDE ${room.round_no}`;$("phaseTitle").textContent=phaseLabel(room.phase);
 document.querySelectorAll(".game-panel").forEach(x=>x.classList.add("hidden"));
 const instructions={night_wolf:"Werewolf sedang memilih korban.",night_seer:"Seer mendapat kesempatan memeriksa pemain.",night_doctor:"Doctor memilih pemain yang dilindungi.",day_result:"Lihat apa yang terjadi semalam.",discussion:"Diskusikan siapa yang paling mencurigakan.",voting:"Saatnya menentukan pilihan.",vote_result:"Lihat hasil voting."};
 $("phaseInstruction").textContent=instructions[room.phase]||"";
 updatePhaseTrail();updateScene();updateSoundUi();updateRoleAttention();
 setNightAmbience(room.phase?.startsWith("night_"));
 if(room.phase.startsWith("night_"))renderNight();else if(room.phase==="day_result")renderDay();else if(room.phase==="discussion")renderDiscussion();else if(room.phase==="voting")renderVoting();else if(room.phase==="vote_result")renderVoteResult();
 horrorNarration();
 startTimer();maybeScheduleWwBots()
}
async function renderFinish(){
 show("finishScreen");await loadPlayers();setNightAmbience(false);const town=room.winner==="town";
 $("finishIcon").textContent=town?"👥":"🐺";$("winnerTitle").textContent=town?"Warga Menang!":"Werewolf Menang!";
 $("winnerText").textContent=town?"Semua Werewolf berhasil ditemukan. Desa kembali aman.":"Werewolf telah menyamai atau melebihi jumlah pemain lain.";
 const {data}=await db.rpc("werewolf_reveal_roles",{p_room_code:roomCode,p_player_id:playerId,p_player_token:token});
 $("roleRevealList").innerHTML=(data||[]).map(x=>`<div class="reveal-row"><span>${esc(x.player_name)}</span><b>${ROLE_META[x.role]?.icon||""} ${ROLE_META[x.role]?.name||x.role}</b></div>`).join("");
 $("backLobbyBtn").classList.toggle("hidden",!isHost);$("finishHint").classList.toggle("hidden",isHost);
 $("moderatorText")&&($("moderatorText").textContent=town?"Desa berhasil mengalahkan Werewolf.":"Werewolf telah menguasai desa.");
 const finishKey=`finish:${roomCode||""}:${room?.match_no||0}:${room?.winner||""}`;
 if(lastNarrationKey!==finishKey){
   lastNarrationKey=finishKey;
   if(hostAudioOn()){
     playSfx(town?"morning":"howl",.58);
     playVoiceSequence(finishKey,[town?"townWin":"wolfWin"],500)
   }
 }
}
async function route(){if(!room)return;if(room.phase==="lobby"){show("lobbyScreen");await loadPlayers();renderLobby()}else if(room.phase==="finished")await renderFinish();else await renderGame()}

async function subscribe(){
 if(roomCh)await db.removeChannel(roomCh);if(playerCh)await db.removeChannel(playerCh);
 setConnectionStatus("CONNECTING");
 roomCh=db.channel(`ww-room-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"werewolf_rooms",filter:`room_code=eq.${roomCode}`},async p=>{if(p.eventType==="DELETE"){leaveLocal("Room sudah ditutup.");return}room=p.new;await route()}).subscribe(status=>setConnectionStatus(status));
 playerCh=db.channel(`ww-players-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"werewolf_players",filter:`room_code=eq.${roomCode}`},async()=>{await loadPlayers();if(room?.phase==="lobby")renderLobby();else renderAlive()}).subscribe()
}
async function enter(){save();await loadRoom();if(!room){leaveLocal("Room tidak ditemukan.");return}await subscribe();await route()}
async function createRoom(){const n=normName($("playerName").value);if(!n){msg("setupMessage","Masukkan nama.");return}const {data,error}=await db.rpc("werewolf_create_room",{p_player_name:n});if(error){msg("setupMessage",friendly(error));return}const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=true;await enter()}
async function joinRoom(){const n=normName($("playerName").value),c=normCode($("roomCodeInput").value);if(!n||c.length!==6){msg("setupMessage","Isi nama dan kode room 6 angka.");return}const {data,error}=await db.rpc("werewolf_join_room",{p_room_code:c,p_player_name:n});if(error){msg("setupMessage",friendly(error));return}const r=data[0];roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=false;await enter()}
async function kick(id){const {error}=await db.rpc("werewolf_kick_player",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_target_id:id});if(error)msg("lobbyMessage",friendly(error))}
async function startGame(){
 if(startingGame)return;startingGame=true;
 const btn=$("startGameBtn"),oldText=btn?.textContent;
 if(btn){btn.disabled=true;btn.classList.add("narrator-starting");btn.textContent=soundEnabled?"MODERATOR MEMULAI...":"MEMULAI..."}
 try{
   lastNarrationKey=null;playedNarrationKeys.clear();roleInfo=null;

   // IMPORTANT:
   // game-start diputar LANGSUNG dari klik tombol Host.
   // Jangan panggil unlockAudio() sebelum ini karena browser dapat
   // menyelesaikan promise unlock terlambat lalu mem-pause game-start.
   if(hostAudioOn()){
     const box=document.querySelector(".moderator-lobby");box?.classList.add("testing");
     stopNarrator();

     const runId=++voiceRunId;
     voiceSequenceKey="game-start";

     // RPC baru dijalankan SETELAH file game-start benar-benar selesai.
     await playNarratorClip("gameStart",runId);

     if(runId===voiceRunId){
       voiceSequenceKey=null;
       audioUnlocked=true
     }
     box?.classList.remove("testing")
   }

   const {error}=await db.rpc("werewolf_start_game",{
     p_room_code:roomCode,
     p_host_id:playerId,
     p_host_token:token
   });
   if(error)msg("lobbyMessage",friendly(error))
 }finally{
   startingGame=false;
   if(btn){
     btn.classList.remove("narrator-starting");
     btn.textContent=oldText||"MULAI GAME";
     btn.disabled=players.length<5
   }
 }
}
async function startVoting(){await db.rpc("werewolf_start_voting",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token})}
async function submitVote(id){if(actionBusy)return;actionBusy=true;const {error}=await db.rpc("werewolf_vote",{p_player_id:playerId,p_player_token:token,p_target_id:id});if(error)alert(friendly(error));else document.querySelectorAll("[data-target]").forEach(b=>{b.disabled=true;b.classList.toggle("selected",Number(b.dataset.target)===id)});actionBusy=false}
async function timeoutPhase(){if(timeoutBusy)return;timeoutBusy=true;await db.rpc("werewolf_timeout_phase",{p_room_code:roomCode});setTimeout(()=>timeoutBusy=false,800)}
function startTimer(){if(timer)clearInterval(timer);const tick=async()=>{if(!room?.phase_started_at||!room?.phase_seconds){$("phaseTimer").textContent="∞";return}const end=new Date(room.phase_started_at).getTime()+room.phase_seconds*1000,left=Math.max(0,Math.ceil((end-Date.now())/1000));$("phaseTimer").textContent=`${left}s`;$("phaseTimer").classList.toggle("warn",left<=10);$("phaseTimer").classList.toggle("danger",left<=5);if(left<=0)await timeoutPhase()};tick();timer=setInterval(tick,500)}
async function leave(){const {error}=await db.rpc("werewolf_leave_room",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error));else leaveLocal("")}
async function leaveLocal(text){if(roomCh)await db.removeChannel(roomCh);if(playerCh)await db.removeChannel(playerCh);setNightAmbience(false);stopNarrator();$("wwPrivateAudio")?.pause();$("wwSfxAudio")?.pause();clear();roomCode=playerId=token=playerName=null;room=null;players=[];roleInfo=null;lastNarrationKey=null;show("setupScreen");msg("setupMessage",text)}
async function backLobby(){stopNarrator();playedNarrationKeys.clear();lastNarrationKey=null;roleInfo=null;const {error}=await db.rpc("werewolf_reset_lobby",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token});if(error)alert(friendly(error))}
function showRole(){
 if(!roleInfo)return;

 // role-reveal adalah audio PRIVAT.
 // Diputar di HP pemain yang sedang membuka kartunya,
 // termasuk non-Host. Tidak dikirim dari HP Host.
 playPrivateRoleNarrator();

 const m=ROLE_META[roleInfo.role];
 $("myRoleIcon").textContent=m.icon;
 $("myRoleName").textContent=m.name;
 $("myRoleDesc").textContent=m.desc;

 const names=roleInfo.wolf_names||[];
 $("wolfFriends").classList.toggle("hidden",roleInfo.role!=="wolf");
 $("wolfFriends").textContent=names.length
   ?`🐺 Werewolf lain: ${names.join(", ")}`
   :"🐺 Kamu satu-satunya Werewolf.";

 hideRoleCard();
 openSheet("roleModal")
}
function beginRoleReveal(e){
 e?.preventDefault();clearTimeout(roleHoldTimer);$("holdRoleBtn").classList.add("holding");
 roleHoldTimer=setTimeout(()=>{
   roleRevealed=true;$("roleFlipCard").classList.add("revealed");localStorage.setItem(roleSeenKey(),"1");updateRoleAttention();playSfx("role",.55,false);
   if(navigator.vibrate)navigator.vibrate(25)
 },320)
}
function endRoleReveal(e){
 e?.preventDefault();clearTimeout(roleHoldTimer);$("holdRoleBtn").classList.remove("holding");
 if(roleRevealed){roleRevealed=false;setTimeout(()=>$("roleFlipCard")?.classList.remove("revealed"),80)}
}
async function loadMatchHistory(){
 const box=$("matchHistoryList");if(!box)return;
 box.innerHTML='<div class="history-empty">Memuat riwayat...</div>';
 const {data,error}=await db.rpc("werewolf_get_match_history",{p_room_code:roomCode,p_player_id:playerId,p_player_token:token});
 if(error){box.innerHTML=`<div class="history-empty">${esc(friendly(error))}</div>`;return}
 if(!data?.length){box.innerHTML='<div class="history-empty">Belum ada pertandingan selesai di room ini.</div>';return}
 box.innerHTML=data.map(h=>{
   const winner=h.winner==="town"?"👥 Warga":"🐺 Werewolf";
   const roles=Array.isArray(h.roles)?h.roles:[];
   return `<article class="history-card"><div class="history-card-head"><span>MATCH ${h.match_no}</span><b>${winner} menang</b></div><small>${h.rounds} ronde • ${new Date(h.finished_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</small><div class="history-roles">${roles.map(r=>`<span>${ROLE_META[r.role]?.icon||"🎭"} ${esc(r.player_name)}</span>`).join("")}</div></article>`
 }).join("")
}
async function openHistory(){openSheet("historyModal");await loadMatchHistory()}

$("continueBtn").onclick=()=>show("setupScreen");document.querySelectorAll("[data-back-intro]").forEach(b=>b.onclick=()=>show("introScreen"));
$("openRolesBtn").onclick=()=>openSheet("rolesHelpModal");$("lobbyHelpBtn").onclick=()=>openSheet("rolesHelpModal");$("menuRulesBtn").onclick=()=>{closeSheets();openSheet("rolesHelpModal")};
document.querySelectorAll("[data-close-sheet]").forEach(b=>b.onclick=closeSheets);$("closeRoleBtn").onclick=closeSheets;
$("createRoomBtn").onclick=createRoom;$("joinRoomBtn").onclick=joinRoom;$("roomCodeInput").oninput=()=>$("roomCodeInput").value=normCode($("roomCodeInput").value);
$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="✓";setTimeout(()=>$("copyCodeBtn").textContent="Salin",800)}catch{}};
$("wwAddBotBtn").onclick=()=>addWwBots(1);$("wwAdd5BotBtn").onclick=()=>addWwBots(5);$("wwRemoveBotsBtn").onclick=removeWwBots;$("wwBotSpeed").onchange=e=>localStorage.setItem("gameAlpiWwBotSpeed",e.target.value);if(localStorage.getItem("gameAlpiWwBotSpeed"))$("wwBotSpeed").value=localStorage.getItem("gameAlpiWwBotSpeed");
$("startGameBtn").onclick=startGame;$("leaveLobbyBtn").onclick=leave;$("roleBtn").onclick=showRole;$("gameMenuBtn").onclick=()=>openSheet("menuSheet");$("leaveGameBtn").onclick=()=>{if(confirm("Benar-benar keluar dari Werewolf?"))leave()};$("backLobbyBtn").onclick=backLobby;
$("soundBtn").onclick=toggleSound;$("lobbySoundBtn").onclick=toggleSound;$("menuSoundBtn").onclick=toggleSound;
$("testNarratorBtn").onclick=playHostPreview;
$("narratorVolume").oninput=e=>setVoiceVolume(e.target.value);
$("historyBtn").onclick=openHistory;$("finishHistoryBtn").onclick=openHistory;$("menuHistoryBtn").onclick=()=>{closeSheets();openHistory()};
$("holdRoleBtn").addEventListener("pointerdown",beginRoleReveal);$("holdRoleBtn").addEventListener("pointerup",endRoleReveal);$("holdRoleBtn").addEventListener("pointercancel",endRoleReveal);$("holdRoleBtn").addEventListener("pointerleave",endRoleReveal);$("holdRoleBtn").oncontextmenu=e=>e.preventDefault();
applyVoiceVolume();updateSoundUi();

(async function boot(){updateSoundUi();const raw=localStorage.getItem(STORE);if(raw){try{const x=JSON.parse(raw);roomCode=x.roomCode;playerId=x.playerId;token=x.token;playerName=x.playerName;isHost=x.isHost;if(roomCode&&playerId&&token){await enter();return}}catch{clear()}}const q=new URLSearchParams(location.search).get("room");if(q){$("roomCodeInput").value=normCode(q);show("setupScreen")}})();