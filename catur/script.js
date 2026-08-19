const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id),STORE="gameAlpiCaturV1";
const PIECES={wp:"♙",wn:"♘",wb:"♗",wr:"♖",wq:"♕",wk:"♔",bp:"♟",bn:"♞",bb:"♝",br:"♜",bq:"♛",bk:"♚"};
let mode=null,roomCode=null,playerId=null,token=null,playerName=null,isHost=false,room=null,players=[],channelRoom=null,channelPlayers=null;
let game=null,selected=null,legal=[],orientation="w",clockTimer=null,actionBusy=false,pendingPromotion=null;
let local={whiteName:"Putih",blackName:"Hitam",timeSec:600,whiteMs:600000,blackMs:600000,turnStarted:Date.now(),finished:false,result:null,reason:""};

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function normName(v){return v.trim().replace(/\s+/g," ").slice(0,20)}function normCode(v){return v.replace(/\D/g,"").slice(0,6)}
function show(id){["modeScreen","multiSetupScreen","lobbyScreen","gameScreen","finishScreen"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden")}
function save(){localStorage.setItem(STORE,JSON.stringify({mode,roomCode,playerId,token,playerName,isHost}))}function clear(){localStorage.removeItem(STORE)}
function openSheet(id){$(id).classList.remove("hidden")}function closeSheets(){document.querySelectorAll(".sheet").forEach(x=>x.classList.add("hidden"))}
function colorName(c){return c==="w"?"Putih":"Hitam"} function opp(c){return c==="w"?"b":"w"} function pcolor(){return players.find(p=>p.id===playerId)?.color}
function friendly(e){const s=String(e?.message||e||"Terjadi kesalahan");if(/schema cache|not find the function/i.test(s))return"Database Catur belum memakai SQL V1.";return s}
function initialFen(){return"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}

function squaresFor(o){const files=o==="w"?["a","b","c","d","e","f","g","h"]:["h","g","f","e","d","c","b","a"],ranks=o==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];return ranks.flatMap(r=>files.map(f=>f+r))}
function renderBoard(){
 const board=$("board"),sqrs=squaresFor(orientation);board.innerHTML="";
 sqrs.forEach(s=>{const file=s.charCodeAt(0)-97,rank=Number(s[1]),light=(file+rank)%2===1,p=game.get(s),isSel=selected===s,m=legal.find(x=>x.to===s);
  const b=document.createElement("button");b.className=`sq ${light?"light":"dark"} ${isSel?"selected":""} ${m?(game.get(s)?"capture":"legal"):""}`;b.dataset.square=s;
  if(p){b.textContent=PIECES[p.color+p.type];b.classList.add(p.color==="w"?"piece-white":"piece-black")}b.onclick=()=>tapSquare(s);board.appendChild(b)
 })
}
function statusText(){
 if(game.in_checkmate())return`${colorName(opp(game.turn()))} menang • Checkmate`;
 if(game.in_stalemate())return"Seri • Stalemate";
 if(game.in_draw())return"Seri";
 if(game.in_check())return`${colorName(game.turn())} dalam CHECK`;
 return`${colorName(game.turn())} jalan`
}
function renderStatus(){
 const b=$("statusBanner");b.textContent=statusText();b.classList.toggle("check",game.in_check());
 const hist=game.history();$("moveCount").textContent=hist.length;$("moveHistory").innerHTML=hist.map((x,i)=>`<span class="move">${i+1}. ${esc(x)}</span>`).join("")
}
function canMove(){
 if(mode==="single")return!local.finished;
 if(!room||room.phase!=="playing")return false;
 return pcolor()===game.turn()
}
function tapSquare(s){
 if(actionBusy||!canMove())return;
 const p=game.get(s);
 if(!selected){if(p&&p.color===game.turn()){selected=s;legal=game.moves({square:s,verbose:true});renderBoard()}return}
 if(s===selected){selected=null;legal=[];renderBoard();return}
 const candidate=legal.find(m=>m.to===s);
 if(!candidate){if(p&&p.color===game.turn()){selected=s;legal=game.moves({square:s,verbose:true});renderBoard()}return}
 if(candidate.flags.includes("p")||candidate.promotion){pendingPromotion={from:selected,to:s};showPromotion();return}
 doMove(selected,s,"q")
}
function showPromotion(){
 const color=game.turn(),icons=color==="w"?{q:"♕",r:"♖",b:"♗",n:"♘"}:{q:"♛",r:"♜",b:"♝",n:"♞"};
 $("promotionChoices").innerHTML=Object.entries(icons).map(([k,v])=>`<button data-prom="${k}">${v}</button>`).join("");
 document.querySelectorAll("[data-prom]").forEach(b=>b.onclick=()=>{closeSheets();doMove(pendingPromotion.from,pendingPromotion.to,b.dataset.prom);pendingPromotion=null});openSheet("promotionModal")
}
function endReason(){
 if(game.in_checkmate())return{result:opp(game.turn()),reason:"Checkmate"};
 if(game.in_stalemate())return{result:"draw",reason:"Stalemate"};
 if(game.insufficient_material())return{result:"draw",reason:"Material tidak cukup"};
 if(game.in_threefold_repetition())return{result:"draw",reason:"Pengulangan posisi tiga kali"};
 if(game.in_draw())return{result:"draw",reason:"Seri"};
 return null
}
async function doMove(from,to,promotion){
 actionBusy=true;
 const movingColor=game.turn();
 if(mode==="single"&&local.timeSec>0){
  const nowTimes=localTimes();
  if(nowTimes[movingColor]<=0){actionBusy=false;finishLocalTimeout(movingColor);return}
 }
 const before=game.fen(),move=game.move({from,to,promotion});if(!move){actionBusy=false;return}
 selected=null;legal=[];const after=game.fen(),ending=endReason();
 if(mode==="single"){
  updateLocalClock(movingColor);
  if(ending){local.finished=true;local.result=ending.result;local.reason=ending.reason}else local.turnStarted=Date.now();
  orientation=game.turn();renderGame();if(ending)showFinishLocal()
 }else{
  const {error}=await db.rpc("chess_make_move",{p_player_id:playerId,p_player_token:token,p_expected_fen:before,p_new_fen:after,p_san:move.san,p_from:from,p_to:to,p_promotion:promotion,p_result:ending?.result||null,p_reason:ending?.reason||null});
  if(error){game.load(before);alert(friendly(error))}else{await loadRoom();syncFromRoom();renderGame()}
 }
 actionBusy=false
}

function fmt(ms){if(ms<=0)return"0:00";const total=Math.ceil(ms/1000),m=Math.floor(total/60),s=total%60;return`${m}:${String(s).padStart(2,"0")}`}
function remoteTimes(){
 let w=Number(room?.white_time_ms||0),b=Number(room?.black_time_ms||0);
 if(room?.phase==="playing"&&room.time_control_sec>0&&room.turn_started_at){const e=Math.max(0,Date.now()-new Date(room.turn_started_at).getTime());if(room.turn_color==="w")w-=e;else b-=e}
 return{w:Math.max(0,w),b:Math.max(0,b)}
}
function updateLocalClock(color){if(local.timeSec===0)return;const e=Date.now()-local.turnStarted;if(color==="w")local.whiteMs=Math.max(0,local.whiteMs-e);else local.blackMs=Math.max(0,local.blackMs-e)}
function localTimes(){
 let w=local.whiteMs,b=local.blackMs;if(!local.finished&&local.timeSec>0){const e=Date.now()-local.turnStarted;if(game.turn()==="w")w-=e;else b-=e}return{w:Math.max(0,w),b:Math.max(0,b)}
}
function renderClocks(){
 const c=mode==="single"?game.turn():room?.turn_color,t=mode==="single"?localTimes():remoteTimes();
 let selfColor,oppColor;
 if(mode==="single"){selfColor=game.turn();oppColor=opp(selfColor)}else{selfColor=pcolor();oppColor=opp(selfColor)}
 $("selfClock").textContent=(mode==="single"?local.timeSec:room?.time_control_sec)===0?"∞":fmt(t[selfColor]);$("oppClock").textContent=(mode==="single"?local.timeSec:room?.time_control_sec)===0?"∞":fmt(t[oppColor]);
 $("selfBox").classList.toggle("active",c===selfColor);$("opponentBox").classList.toggle("active",c===oppColor);
 if((mode==="single"?local.timeSec:room?.time_control_sec)>0){
  if(t[c]<=0){if(mode==="single")finishLocalTimeout(c);else db.rpc("chess_timeout",{p_room_code:roomCode})}
 }
}
function renderPlayersMulti(){
 const self=players.find(p=>p.id===playerId),other=players.find(p=>p.id!==playerId),sc=self?.color||"w",oc=opp(sc);
 orientation=sc;$("selfName").textContent=self?.player_name||colorName(sc);$("oppName").textContent=other?.player_name||colorName(oc);$("selfPiece").textContent=sc==="w"?"♙":"♟";$("oppPiece").textContent=oc==="w"?"♙":"♟";
 $("selfStatus").textContent=room.turn_color===sc?"Giliranmu":"Menunggu";$("oppStatus").textContent=room.turn_color===oc?"Sedang berpikir":"Menunggu";
 const offer=room.draw_offer_by;$("drawOfferPanel").classList.toggle("hidden",!offer||offer===playerId)
}
function renderGame(){
 show("gameScreen");$("gameSub").textContent=mode==="single"?"1 HP • Pass-and-play":`Multi HP • Room ${roomCode}`;
 if(mode==="single"){
  orientation=game.turn();$("selfName").textContent=`${colorName(game.turn())} • giliran`; $("oppName").textContent=colorName(opp(game.turn()));$("selfPiece").textContent=game.turn()==="w"?"♙":"♟";$("oppPiece").textContent=game.turn()==="w"?"♟":"♙";$("selfStatus").textContent="Main sekarang";$("oppStatus").textContent="Oper HP setelah langkah";
 }else renderPlayersMulti();
 renderBoard();renderStatus();renderClocks();startClock()
}
function startClock(){if(clockTimer)clearInterval(clockTimer);clockTimer=setInterval(renderClocks,400)}

async function loadRoom(){const {data}=await db.from("chess_rooms").select("*").eq("room_code",roomCode).maybeSingle();room=data;return data}
async function loadPlayers(){const {data}=await db.from("chess_players").select("*").eq("room_code",roomCode).order("seat_order");players=data||[];const me=players.find(p=>p.id===playerId);if(me){isHost=!!me.is_host;save()}return players}
function syncFromRoom(){if(!game)game=new Chess();if(room?.fen)game.load(room.fen)}
function renderLobby(){
 $("roomCodeDisplay").textContent=roomCode;$("playersList").innerHTML=players.map(p=>`<div class="player"><div><span class="avatar">${esc(p.player_name[0])}</span><b>${esc(p.player_name)}</b></div><small>${p.is_host?"HOST":"Pemain"}</small></div>`).join("");$("hostPanel").classList.toggle("hidden",!isHost);$("startGameBtn").disabled=players.length!==2
}
async function route(){
 if(room.phase==="lobby"){show("lobbyScreen");await loadPlayers();renderLobby()}
 else if(room.phase==="playing"){await loadPlayers();syncFromRoom();renderGame()}
 else{await loadPlayers();syncFromRoom();showFinishRemote()}
}
async function subscribe(){
 if(channelRoom)await db.removeChannel(channelRoom);if(channelPlayers)await db.removeChannel(channelPlayers);
 channelRoom=db.channel(`chess-room-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"chess_rooms",filter:`room_code=eq.${roomCode}`},async p=>{if(p.eventType==="DELETE"){leaveLocal("Room ditutup.");return}room=p.new;await route()}).subscribe();
 channelPlayers=db.channel(`chess-players-${roomCode}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"chess_players",filter:`room_code=eq.${roomCode}`},async()=>{await loadPlayers();if(room.phase==="lobby")renderLobby();else renderPlayersMulti()}).subscribe()
}
async function enter(){save();await loadRoom();if(!room){leaveLocal("Room tidak ditemukan.");return}game=new Chess(room.fen||initialFen());await subscribe();await route()}
async function createRoom(){const n=normName($("playerName").value);if(!n){$("setupMessage").textContent="Masukkan nama.";return}const {data,error}=await db.rpc("chess_create_room",{p_player_name:n});if(error){$("setupMessage").textContent=friendly(error);return}const r=data[0];mode="multi";roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=true;await enter()}
async function joinRoom(){const n=normName($("playerName").value),c=normCode($("roomCodeInput").value);if(!n||c.length!==6){$("setupMessage").textContent="Isi nama dan kode 6 angka.";return}const {data,error}=await db.rpc("chess_join_room",{p_room_code:c,p_player_name:n});if(error){$("setupMessage").textContent=friendly(error);return}const r=data[0];mode="multi";roomCode=r.room_code;playerId=r.player_id;token=r.player_token;playerName=n;isHost=false;await enter()}
async function startRemote(){const sec=Number($("timeControl").value);const {error}=await db.rpc("chess_start_game",{p_room_code:roomCode,p_host_id:playerId,p_host_token:token,p_time_control_sec:sec});if(error)$("lobbyMessage").textContent=friendly(error)}
async function offerDraw(){if(mode==="single"){if(confirm("Kedua pemain sepakat seri?")){local.finished=true;local.result="draw";local.reason="Seri atas kesepakatan";showFinishLocal()}return}const {error}=await db.rpc("chess_offer_draw",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error))}
async function respondDraw(accept){const {error}=await db.rpc("chess_respond_draw",{p_player_id:playerId,p_player_token:token,p_accept:accept});if(error)alert(friendly(error))}
async function resign(){if(!confirm("Yakin ingin menyerah?"))return;if(mode==="single"){local.finished=true;local.result=opp(game.turn());local.reason=`${colorName(game.turn())} menyerah`;showFinishLocal()}else{const {error}=await db.rpc("chess_resign",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error))}}
function showFinishRemote(){
 if(clockTimer)clearInterval(clockTimer);
 show("finishScreen");const win=room.winner_color,draw=win==="draw";$("finishTitle").textContent=draw?"Seri":`${colorName(win)} Menang`;$("finishReason").textContent=room.result_reason||"Partai selesai.";
 const canRematch=players.length===2;
 $("rematchBtn").classList.toggle("hidden",!canRematch);
 if(canRematch){
  $("rematchBtn").textContent=room[`rematch_${pcolor()==="w"?"white":"black"}`]?"Menunggu Lawan...":"Rematch";
  $("rematchHint").textContent="Rematch dimulai jika kedua pemain setuju.";
 }else{
  $("rematchHint").textContent="Lawan sudah keluar dari room. Mulai room baru untuk bermain lagi.";
 }
}
function showFinishLocal(){if(clockTimer)clearInterval(clockTimer);show("finishScreen");$("finishTitle").textContent=local.result==="draw"?"Seri":`${colorName(local.result)} Menang`;$("finishReason").textContent=local.reason;$("rematchBtn").classList.remove("hidden");$("rematchBtn").textContent="Rematch";$("rematchHint").textContent=""}
function finishLocalTimeout(c){if(local.finished)return;local.finished=true;local.result=opp(c);local.reason=`Waktu ${colorName(c)} habis`;showFinishLocal()}
async function rematch(){if(mode==="single"){startSingle(local.timeSec);return}const {error}=await db.rpc("chess_rematch",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error))}
async function leave(){if(mode==="single"){show("modeScreen");return}const {error}=await db.rpc("chess_leave_room",{p_player_id:playerId,p_player_token:token});if(error)alert(friendly(error));else leaveLocal("")}
async function leaveLocal(text){if(channelRoom)await db.removeChannel(channelRoom);if(channelPlayers)await db.removeChannel(channelPlayers);clear();mode=roomCode=playerId=token=playerName=null;room=null;players=[];game=null;show("multiSetupScreen");$("setupMessage").textContent=text||""}
function startSingle(sec=600){mode="single";game=new Chess();local={whiteName:"Putih",blackName:"Hitam",timeSec:sec,whiteMs:sec*1000,blackMs:sec*1000,turnStarted:Date.now(),finished:false,result:null,reason:""};orientation="w";renderGame()}

$("multiModeBtn").onclick=()=>{mode="multi";show("multiSetupScreen")};$("singleModeBtn").onclick=()=>openSheet("singleSetupModal");$("startSingleBtn").onclick=()=>{const sec=Number($("singleTimeControl").value);closeSheets();startSingle([0,300,600,900].includes(sec)?sec:600)};$("backModeBtn").onclick=()=>show("modeScreen");
$("rulesBtn").onclick=()=>openSheet("rulesModal");$("menuRulesBtn").onclick=()=>{closeSheets();openSheet("rulesModal")};document.querySelectorAll("[data-close-sheet]").forEach(b=>b.onclick=closeSheets);
$("createRoomBtn").onclick=createRoom;$("joinRoomBtn").onclick=joinRoom;$("roomCodeInput").oninput=()=>$("roomCodeInput").value=normCode($("roomCodeInput").value);$("copyCodeBtn").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copyCodeBtn").textContent="✓";setTimeout(()=>$("copyCodeBtn").textContent="Salin",800)}catch{}};
$("startGameBtn").onclick=startRemote;$("leaveLobbyBtn").onclick=leave;$("drawBtn").onclick=offerDraw;$("resignBtn").onclick=resign;$("acceptDrawBtn").onclick=()=>respondDraw(true);$("declineDrawBtn").onclick=()=>respondDraw(false);$("rematchBtn").onclick=rematch;
$("gameMenuBtn").onclick=()=>openSheet("menuModal");$("leaveGameBtn").onclick=()=>{closeSheets();if(confirm("Keluar dari pertandingan Catur? Jika Multi HP, lawan akan menang."))leave()};$("finishHomeBtn").onclick=()=>{if(mode==="single")show("modeScreen");else leave()};
(async function boot(){const raw=localStorage.getItem(STORE);if(raw){try{const x=JSON.parse(raw);if(x.mode==="multi"&&x.roomCode&&x.playerId&&x.token){Object.assign(window,{ });mode=x.mode;roomCode=x.roomCode;playerId=x.playerId;token=x.token;playerName=x.playerName;isHost=x.isHost;await enter();return}}catch{clear()}}const q=new URLSearchParams(location.search).get("room");if(q){$("roomCodeInput").value=normCode(q);show("multiSetupScreen")}})();