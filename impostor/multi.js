const SUPABASE_URL="https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const screens={setup:$('setupScreen'),lobby:$('lobbyScreen'),reveal:$('revealScreen'),waiting:$('waitingScreen'),discussion:$('discussionScreen'),voting:$('votingScreen'),voteWaiting:$('voteWaitingScreen'),result:$('resultScreen'),final:$('finalScreen')};
const ALL_CATEGORIES=['Hewan','Benda','Tempat','Makanan','Buah','Kendaraan','Pekerjaan','Olahraga'];
const STORAGE_KEY='gameAlpiImpostorV11';
let currentRoomCode=null,currentPlayerId=null,currentPlayerToken=null,currentPlayerName=null,currentIsHost=false,currentRoom=null,currentPhase='setup';
let impostorCount=1,impostorKnows=true,clueCount=2,showCategoryToImpostor=true,difficulty='normal',discussionSeconds=180,tieRule='revote',scoreEnabled=true,matchTarget=1;
let selectedVoteId=null,roomChannel=null,playerChannel=null,timerHandle=null,qrInstance=null;

function esc(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function normName(v){return v.trim().replace(/\s+/g,' ').slice(0,20)}function normCode(v){return v.replace(/\D/g,'').slice(0,6)}
function hideScreens(){Object.values(screens).forEach(x=>x.classList.add('hidden'))}function showScreen(name){hideScreens();screens[name].classList.remove('hidden');currentPhase=name}
function setConnection(ok,text){$('connectionBadge').classList.remove('connected','error');$('connectionBadge').classList.add(ok?'connected':'error');$('connectionText').textContent=text}
function saveSession(){localStorage.setItem(STORAGE_KEY,JSON.stringify({roomCode:currentRoomCode,playerId:currentPlayerId,playerToken:currentPlayerToken,playerName:currentPlayerName,isHost:currentIsHost}))}function clearSession(){localStorage.removeItem(STORAGE_KEY)}
function selectedCategories(){return [...document.querySelectorAll('#categoryGrid input:checked')].map(x=>x.value)}
function setCategories(vals){const s=new Set(vals||[]);document.querySelectorAll('#categoryGrid input').forEach(x=>x.checked=s.has(x.value));updateCategorySummary()}
function updateCategorySummary(){const n=selectedCategories().length;$('categorySummary').textContent=n?`${n} kategori aktif`:'Tidak ada kategori'}
function setPair(a,b,val){$(a).classList.toggle('active',!!val);$(b).classList.toggle('active',!val)}
function syncSettings(){if(!impostorKnows)clueCount=1;setPair('knowsYesBtn','knowsNoBtn',impostorKnows);setPair('showCatYesBtn','showCatNoBtn',showCategoryToImpostor);setPair('scoreYesBtn','scoreNoBtn',scoreEnabled);$('clueCountDisplay').textContent=clueCount;$('minusClueBtn').disabled=!impostorKnows||clueCount<=1;$('plusClueBtn').disabled=!impostorKnows||clueCount>=3;$('clueLockText').classList.toggle('hidden',impostorKnows);$('difficultySelect').value=difficulty;$('discussionTimerSelect').value=String(discussionSeconds);$('tieRuleSelect').value=tieRule;$('matchTargetSelect').value=String(matchTarget)}
function maxImpostors(n){return n<3?1:1+Math.floor((n-3)/3)}
function updateImp(n){const m=maxImpostors(n);impostorCount=Math.max(1,Math.min(impostorCount,m));$('impostorCountDisplay').textContent=impostorCount;$('impostorHelp').textContent=`${impostorCount} impostor dari ${n} pemain`;$('minusImpostorBtn').disabled=impostorCount<=1;$('plusImpostorBtn').disabled=impostorCount>=m;$('startGameBtn').disabled=n<3}
function renderScore(target,rows){if(!rows?.length){target.innerHTML='<div class="you">Belum ada skor.</div>';return}target.innerHTML=rows.map((r,i)=>`<div class="score-row"><div class="score-left"><span class="rank">${i+1}</span><span class="score-name">${esc(r.player_name)}</span></div><span class="score-points">${r.score} poin</span></div>`).join('')}
async function loadScore(target){if(!currentPlayerId)return;const {data,error}=await db.rpc('impostor_get_scoreboard',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(!error)renderScore(target,data||[])}

async function loadRoom(){if(!currentRoomCode)return null;const {data}=await db.from('rooms').select('room_code,game_phase,round_no,selected_categories,impostor_knows,impostor_clue_count,show_category_to_impostor,difficulty,discussion_duration_seconds,discussion_started_at,tie_rule,score_enabled,match_target_games,completed_games,match_status,vote_cycle,discussion_first_player_id').eq('room_code',currentRoomCode).maybeSingle();currentRoom=data;return data}
async function handleRemoved(){await unsubscribe();clearSession();currentRoomCode=currentPlayerId=currentPlayerToken=currentPlayerName=null;currentIsHost=false;showScreen('setup');$('setupMessage').textContent='Kamu sudah tidak berada di room ini.'}
async function loadPlayers(){if(!currentRoomCode)return[];const {data,error}=await db.from('players').select('id,player_name,is_host,role_seen,vote_submitted,score,is_alive,created_at').eq('room_code',currentRoomCode).order('created_at',{ascending:true});if(error)return[];const me=data.find(p=>String(p.id)===String(currentPlayerId));if(currentPlayerId&&!me){await handleRemoved();return[]}
 const alive=data.filter(p=>p.is_alive!==false);$('playerCount').textContent=`${data.length} pemain`;$('seenProgress').textContent=`${alive.filter(p=>p.role_seen).length} / ${alive.length} siap`;$('voteProgress').textContent=`${alive.filter(p=>p.vote_submitted).length} / ${alive.length} sudah vote`;
 $('playersList').innerHTML=data.map(p=>`<div class="player-row"><div class="player-left"><div class="avatar">${esc((p.player_name||'?')[0].toUpperCase())}</div><div class="player-text"><div class="player-name">${esc(p.player_name)}${p.is_alive===false?' ☠️':''}</div><div class="you">${String(p.id)===String(currentPlayerId)?'Kamu • ':''}${scoreEnabled?(p.score||0)+' poin':''}</div></div></div><div class="player-actions">${p.is_host?'<span class="crown">👑 HOST</span>':''}${currentIsHost&&currentPhase==='lobby'&&!p.is_host?`<button class="kick-btn" data-kick="${p.id}">Kick</button>`:''}</div></div>`).join('');
 document.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>kickPlayer(Number(b.dataset.kick)));if(currentIsHost)updateImp(alive.length);return data}
async function kickPlayer(id){if(!confirm('Keluarkan pemain ini dari room?'))return;const {error}=await db.rpc('impostor_kick_player',{p_room_code:currentRoomCode,p_host_id:currentPlayerId,p_host_token:currentPlayerToken,p_target_player_id:id});if(error)$('lobbyMessage').textContent=error.message}

function joinUrl(){const u=new URL(location.href);u.search='';u.searchParams.set('room',currentRoomCode);return u.toString()}
function renderQr(){const box=$('qrcode');box.innerHTML='';if(window.QRCode){qrInstance=new QRCode(box,{text:joinUrl(),width:180,height:180,correctLevel:QRCode.CorrectLevel.M})}}
function toggleQr(){$('qrPanel').classList.toggle('hidden');if(!$('qrPanel').classList.contains('hidden'))renderQr()}

async function showLobby(){clearTimer();showScreen('lobby');$('roomCodeDisplay').textContent=currentRoomCode;if(currentIsHost){$('hostBadge').classList.remove('hidden');$('hostControls').classList.remove('hidden')}else{$('hostBadge').classList.add('hidden');$('hostControls').classList.add('hidden')}
 const room=await loadRoom();if(room&&currentIsHost){setCategories(room.selected_categories?.length?room.selected_categories:ALL_CATEGORIES);impostorKnows=room.impostor_knows!==false;clueCount=Number(room.impostor_clue_count||2);showCategoryToImpostor=room.show_category_to_impostor!==false;difficulty=room.difficulty||'normal';discussionSeconds=Number(room.discussion_duration_seconds||0);tieRule=room.tie_rule||'revote';scoreEnabled=room.score_enabled!==false;matchTarget=Number(room.match_target_games??1);syncSettings()}
 $('lobbyScoreSection').classList.toggle('hidden',room?.score_enabled===false);$('finishLobbyBtn').classList.toggle('hidden',!currentIsHost||!(room?.completed_games>0));await loadPlayers();if(room?.score_enabled!==false)await loadScore($('lobbyScoreboard'))}
async function showRevealOrWaiting(){clearTimer();const ps=await loadPlayers();const me=ps.find(p=>String(p.id)===String(currentPlayerId));if(me?.role_seen){showScreen('waiting');return}await loadMyRole();showScreen('reveal')}
async function loadMyRole(){const {data,error}=await db.rpc('impostor_get_my_role',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error||!data?.length){$('revealMessage').textContent=error?.message||'Informasi belum tersedia.';return}const r=data[0];const hidden=r.role==='hidden';$('roleCard').classList.toggle('impostor',r.role==='impostor');$('roleCard').classList.toggle('neutral-role',hidden);
 if(hidden){$('roleLabel').textContent='INFORMASI RAHASIA';$('roleName').textContent='';$('secretLabel').textContent='PETUNJUKMU';$('secretValue').textContent=(r.clues||[]).join(' • ');$('roleDescription').textContent='Identitas role tidak ditampilkan. Gunakan informasi ini saat berdiskusi.'}
 else if(r.role==='impostor'){$('roleLabel').textContent='PERANMU';$('roleName').textContent='IMPOSTOR';$('secretLabel').textContent='CLUE';$('secretValue').textContent=(r.clues||[]).join(' • ');$('roleDescription').textContent='Kamu adalah Impostor. Kamu tidak mengetahui kata rahasia.'}
 else{$('roleLabel').textContent='PERANMU';$('roleName').textContent='Warga';$('secretLabel').textContent='KATA RAHASIA';$('secretValue').textContent=r.secret_word;$('roleDescription').textContent='Fokus pada kata rahasia. Jangan menyebutnya secara langsung.'}
 const showCat=!!r.category;$('roleCategoryWrap').classList.toggle('hidden',!showCat);$('roleCategory').textContent=r.category||''}
function clearTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}}
function timerText(sec){const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function startTimer(room){clearTimer();const el=$('discussionTimer');const dur=Number(room?.discussion_duration_seconds||0);if(!dur){el.textContent='Tanpa batas';el.classList.remove('expired');return}const start=room?.discussion_started_at?new Date(room.discussion_started_at).getTime():Date.now();const tick=()=>{const rem=Math.max(0,dur-Math.floor((Date.now()-start)/1000));el.textContent=rem?`⏱ ${timerText(rem)}`:'⏱ 00:00 • Waktu habis';el.classList.toggle('expired',rem===0)};tick();timerHandle=setInterval(tick,1000)}
async function showDiscussion(){
 showScreen('discussion');
 $('discussionRoomCode').textContent=currentRoomCode;
 const room=await loadRoom();
 const ps=await loadPlayers();
 const first=ps.find(p=>String(p.id)===String(room?.discussion_first_player_id));
 $('discussionFirstSpeaker').textContent=first?.player_name||'Ditentukan host';
 startTimer(room);
 if(currentIsHost){$('startVotingBtn').classList.remove('hidden');$('discussionHint').classList.add('hidden')}
 else{$('startVotingBtn').classList.add('hidden');$('discussionHint').classList.remove('hidden')}
}
async function showVotingOrWaiting(){clearTimer();const ps=await loadPlayers();const me=ps.find(p=>String(p.id)===String(currentPlayerId));if(me?.is_alive===false||me?.vote_submitted){showScreen('voteWaiting');if(me?.is_alive===false)$('voteProgress').textContent='Kamu tereliminasi • menonton ronde';return}selectedVoteId=null;$('submitVoteBtn').disabled=true;$('voteMessage').textContent='';const choices=ps.filter(p=>p.is_alive!==false&&String(p.id)!==String(currentPlayerId));$('voteOptions').innerHTML=choices.map(p=>`<button class="vote-option" data-id="${p.id}"><span class="vote-radio"></span><span class="vote-avatar">${esc((p.player_name||'?')[0].toUpperCase())}</span><span class="vote-player-name">${esc(p.player_name)}</span></button>`).join('');document.querySelectorAll('.vote-option').forEach(b=>b.onclick=()=>{document.querySelectorAll('.vote-option').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');selectedVoteId=Number(b.dataset.id);$('submitVoteBtn').disabled=false});showScreen('voting')}
async function loadHistory(target=$('historyList')){const {data}=await db.rpc('impostor_get_history',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});target.innerHTML=(data||[]).map(r=>`<div class="history-card"><div class="history-card-head"><span class="history-round">Voting ${r.round_no}</span><span class="history-winner">${r.winner==='civilian'?'WARGA':r.winner==='impostor'?'IMPOSTOR':'LANJUT'}</span></div><div class="history-meta"><div>Terpilih: <strong>${esc(r.eliminated_player_name||'Seri')}</strong></div><div>Status: <strong>${r.eliminated_role==='impostor'?'Impostor':r.eliminated_role==='civilian'?'Warga':'Tidak ada eliminasi'}</strong></div>${r.secret_word?`<div>Kata: <strong>${esc(r.secret_word)}</strong></div>`:''}</div></div>`).join('')||'<div class="you">Belum ada riwayat.</div>'}
async function showResult(){clearTimer();showScreen('result');const {data,error}=await db.rpc('impostor_get_result',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error||!data){$('resultMessage').textContent=error?.message||'Hasil belum tersedia.';return}const gameOver=!!data.game_over,tournamentOver=!!data.tournament_over;$('winnerTitle').textContent=gameOver?(data.winner==='civilian'?'Warga Menang!':'Impostor Menang!'):'Ronde Selesai';$('eliminationCard').classList.remove('win-civilian','win-impostor');if(gameOver)$('eliminationCard').classList.add(data.winner==='civilian'?'win-civilian':'win-impostor');$('resultSmallLabel').textContent=data.tie?'VOTING SERI':'PEMAIN TERPILIH';$('eliminatedName').textContent=data.tie?'Tidak Ada Eliminasi':(data.eliminated_player_name||'-');$('eliminatedDetail').textContent=data.message||'';$('resultSecretWord').textContent=data.secret_word||'Tetap rahasia';$('resultCategory').textContent=data.category||'-';$('resultImpostors').textContent=gameOver?((data.remaining_impostors||[]).join(', ')||'Tidak ada'):`${data.remaining_impostor_count??'?'} pemain`;$('resultRound').textContent=data.round_no||'-';$('voteTotals').innerHTML=(data.vote_totals||[]).map(r=>`<div class="vote-total-row"><strong>${esc(r.player_name)}</strong><span>${r.votes} suara</span></div>`).join('');$('resultScoreSection').classList.toggle('hidden',data.score_enabled===false);if(data.score_enabled!==false)await loadScore($('resultScoreboard'));await loadHistory();
 ['continueGameBtn','playAgainBtn','finishMatchBtn'].forEach(id=>$(id).classList.add('hidden'));if(currentIsHost){$('resultHostHint').classList.add('hidden');if(!gameOver){$('continueGameBtn').classList.remove('hidden')}else if(tournamentOver){$('finishMatchBtn').textContent='Lihat Hasil Akhir';$('finishMatchBtn').classList.remove('hidden')}else{$('playAgainBtn').textContent='Game Berikutnya';$('playAgainBtn').classList.remove('hidden');$('finishMatchBtn').textContent='Selesai Pertandingan Sekarang';$('finishMatchBtn').classList.remove('hidden')}}else $('resultHostHint').classList.remove('hidden')}
async function showFinal(){clearTimer();showScreen('final');const room=await loadRoom();const {data}=await db.rpc('impostor_get_scoreboard',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(room?.score_enabled===false){$('finalTitle').textContent='Pertandingan Selesai';$('finalPodium').innerHTML=(data||[]).map((r,i)=>`<div class="podium-row"><span class="podium-name">${i+1}. ${esc(r.player_name)}</span><span class="podium-score">Skor nonaktif</span></div>`).join('')}else{$('finalTitle').textContent='🏆 Pemenang Pertandingan';$('finalPodium').innerHTML=(data||[]).map((r,i)=>`<div class="podium-row"><span class="podium-name">${i===0?'🏆 ':''}${i+1}. ${esc(r.player_name)}</span><span class="podium-score">${r.score} poin</span></div>`).join('')}await loadHistory($('finalHistory'))}
async function showPhase(phase){currentPhase=phase;if(phase==='lobby')return showLobby();if(phase==='reveal')return showRevealOrWaiting();if(phase==='discussion')return showDiscussion();if(phase==='voting')return showVotingOrWaiting();if(phase==='result')return showResult();if(phase==='finished')return showFinal()}

async function unsubscribe(){if(roomChannel){await db.removeChannel(roomChannel);roomChannel=null}if(playerChannel){await db.removeChannel(playerChannel);playerChannel=null}}
async function subscribe(){await unsubscribe();roomChannel=db.channel(`room-${currentRoomCode}-${Date.now()}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`room_code=eq.${currentRoomCode}`},async p=>{currentRoom=p.new;await showPhase(p.new.game_phase)}).on('postgres_changes',{event:'DELETE',schema:'public',table:'rooms',filter:`room_code=eq.${currentRoomCode}`},async()=>handleRemoved()).subscribe(s=>{if(s==='SUBSCRIBED')setConnection(true,'Supabase Realtime terhubung')});playerChannel=db.channel(`players-${currentRoomCode}-${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`room_code=eq.${currentRoomCode}`},async()=>{await loadPlayers();if(currentPhase==='lobby'&&currentRoom?.score_enabled!==false)await loadScore($('lobbyScoreboard'))}).subscribe()}
async function enterRoom(){saveSession();const room=await loadRoom();if(!room){clearSession();showScreen('setup');$('setupMessage').textContent='Room sudah tidak tersedia.';return}await showPhase(room.game_phase||'lobby');await subscribe()}
async function createRoom(){const name=normName($('playerName').value);if(!name){$('setupMessage').textContent='Isi nama pemain.';return}$('createRoomBtn').disabled=true;const {data,error}=await db.rpc('impostor_create_room',{p_player_name:name});$('createRoomBtn').disabled=false;if(error||!data?.length){$('setupMessage').textContent=error?.message||'Gagal membuat room.';return}const r=data[0];currentRoomCode=r.room_code;currentPlayerId=r.player_id;currentPlayerToken=r.player_token;currentPlayerName=name;currentIsHost=true;await enterRoom()}
async function joinRoom(){const name=normName($('playerName').value),code=normCode($('roomCodeInput').value);if(!name||code.length!==6){$('setupMessage').textContent='Isi nama dan kode 6 digit.';return}$('joinRoomBtn').disabled=true;const {data,error}=await db.rpc('impostor_join_room',{p_room_code:code,p_player_name:name});$('joinRoomBtn').disabled=false;if(error||!data?.length){$('setupMessage').textContent=error?.message||'Gagal gabung room.';return}const r=data[0];currentRoomCode=r.room_code;currentPlayerId=r.player_id;currentPlayerToken=r.player_token;currentPlayerName=name;currentIsHost=false;await enterRoom()}
async function startGame(){const cats=selectedCategories();if(!cats.length){$('lobbyMessage').textContent='Pilih minimal 1 kategori.';return}$('startGameBtn').disabled=true;const {error}=await db.rpc('impostor_start_game',{p_room_code:currentRoomCode,p_player_id:currentPlayerId,p_player_token:currentPlayerToken,p_impostor_count:impostorCount,p_categories:cats,p_impostor_knows:impostorKnows,p_clue_count:clueCount,p_show_category_to_impostor:showCategoryToImpostor,p_difficulty:difficulty,p_discussion_seconds:discussionSeconds,p_tie_rule:tieRule,p_score_enabled:scoreEnabled,p_match_target_games:matchTarget});if(error){$('lobbyMessage').textContent=error.message;$('startGameBtn').disabled=false}}
async function markSeen(){$('seenBtn').disabled=true;const {data,error}=await db.rpc('impostor_mark_seen',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error){$('revealMessage').textContent=error.message;$('seenBtn').disabled=false;return}if(data==='discussion')await showDiscussion();else{showScreen('waiting');await loadPlayers()}}
async function startVoting(){$('startVotingBtn').disabled=true;const {error}=await db.rpc('impostor_start_voting',{p_room_code:currentRoomCode,p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error){$('discussionMessage').textContent=error.message;$('startVotingBtn').disabled=false}}
async function submitVote(){if(!selectedVoteId)return;$('submitVoteBtn').disabled=true;const {data,error}=await db.rpc('impostor_cast_vote',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken,p_voted_player_id:selectedVoteId});if(error){$('voteMessage').textContent=error.message;$('submitVoteBtn').disabled=false;return}if(data==='result')await showResult();else if(data==='revote'){$('voteMessage').textContent='Voting seri. Voting diulang.';await showVotingOrWaiting()}else{showScreen('voteWaiting');await loadPlayers()}}
async function continueGame(){const {error}=await db.rpc('impostor_continue_match',{p_room_code:currentRoomCode,p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error)$('resultMessage').textContent=error.message}
async function nextGame(){const {error}=await db.rpc('impostor_reset_lobby',{p_room_code:currentRoomCode,p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error)$('resultMessage').textContent=error.message}
async function finishMatch(){const {error}=await db.rpc('impostor_finish_match',{p_room_code:currentRoomCode,p_player_id:currentPlayerId,p_player_token:currentPlayerToken});if(error){$('resultMessage').textContent=error.message;$('lobbyMessage').textContent=error.message}}
async function leaveRoom(){if(currentPlayerId&&currentPlayerToken)await db.rpc('impostor_leave_room',{p_player_id:currentPlayerId,p_player_token:currentPlayerToken});await unsubscribe();clearSession();currentRoomCode=currentPlayerId=currentPlayerToken=currentPlayerName=null;currentIsHost=false;showScreen('setup')}
async function restore(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;try{const s=JSON.parse(raw);currentRoomCode=s.roomCode;currentPlayerId=s.playerId;currentPlayerToken=s.playerToken;currentPlayerName=s.playerName;currentIsHost=s.isHost;if(currentRoomCode&&currentPlayerId&&currentPlayerToken)await enterRoom()}catch{clearSession()}}

$('createRoomBtn').onclick=createRoom;$('joinRoomBtn').onclick=joinRoom;$('roomCodeInput').oninput=()=>$('roomCodeInput').value=normCode($('roomCodeInput').value);$('minusImpostorBtn').onclick=async()=>{if(impostorCount>1)impostorCount--;updateImp((await loadPlayers()).filter(p=>p.is_alive!==false).length)};$('plusImpostorBtn').onclick=async()=>{impostorCount++;updateImp((await loadPlayers()).filter(p=>p.is_alive!==false).length)};
$('selectAllCategoriesBtn').onclick=()=>setCategories(ALL_CATEGORIES);$('clearAllCategoriesBtn').onclick=()=>setCategories([]);document.querySelectorAll('#categoryGrid input').forEach(x=>x.onchange=updateCategorySummary);
$('knowsYesBtn').onclick=()=>{impostorKnows=true;syncSettings()};$('knowsNoBtn').onclick=()=>{impostorKnows=false;clueCount=1;syncSettings()};$('minusClueBtn').onclick=()=>{clueCount=Math.max(1,clueCount-1);syncSettings()};$('plusClueBtn').onclick=()=>{clueCount=Math.min(3,clueCount+1);syncSettings()};$('showCatYesBtn').onclick=()=>{showCategoryToImpostor=true;syncSettings()};$('showCatNoBtn').onclick=()=>{showCategoryToImpostor=false;syncSettings()};$('scoreYesBtn').onclick=()=>{scoreEnabled=true;syncSettings()};$('scoreNoBtn').onclick=()=>{scoreEnabled=false;syncSettings()};$('difficultySelect').onchange=e=>difficulty=e.target.value;$('discussionTimerSelect').onchange=e=>discussionSeconds=Number(e.target.value);$('tieRuleSelect').onchange=e=>tieRule=e.target.value;$('matchTargetSelect').onchange=e=>matchTarget=Number(e.target.value);
$('startGameBtn').onclick=startGame;$('seenBtn').onclick=markSeen;$('startVotingBtn').onclick=startVoting;$('submitVoteBtn').onclick=submitVote;$('continueGameBtn').onclick=continueGame;$('playAgainBtn').onclick=nextGame;$('finishMatchBtn').onclick=finishMatch;$('finishLobbyBtn').onclick=finishMatch;$('leaveRoomBtn').onclick=leaveRoom;$('refreshScoreBtn').onclick=()=>loadScore($('lobbyScoreboard'));
$('copyCodeBtn').onclick=async()=>{try{await navigator.clipboard.writeText(currentRoomCode);$('copyCodeBtn').textContent='Tersalin ✓';setTimeout(()=>$('copyCodeBtn').textContent='Salin',1200)}catch{}};$('showQrBtn').onclick=toggleQr;$('copyJoinLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl());$('copyJoinLinkBtn').textContent='Link tersalin ✓';setTimeout(()=>$('copyJoinLinkBtn').textContent='Salin Link Join',1200)}catch{}};

async function boot(){syncSettings();updateCategorySummary();try{await db.rpc('impostor_cleanup_rooms');setConnection(true,'Supabase terhubung')}catch{setConnection(false,'Supabase belum siap V11')}const q=new URLSearchParams(location.search).get('room');if(q)$('roomCodeInput').value=normCode(q);await restore()}
boot();


function initHelpTips() {
  const pop = document.getElementById("helpPopover");
  if (!pop) return;

  let active = null;
  let pinned = false;
  let hoverTimer = null;

  function position(btn) {
    if (!active || pop.classList.contains("hidden")) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const gap = 8;

    pop.style.left = "0px";
    pop.style.top = "0px";
    pop.classList.remove("above");

    const pw = Math.min(pop.offsetWidth, window.innerWidth - margin * 2);
    const ph = pop.offsetHeight;

    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));

    let top = rect.bottom + gap;
    let above = false;
    if (top + ph > window.innerHeight - margin) {
      top = rect.top - ph - gap;
      above = true;
    }
    top = Math.max(margin, top);

    const arrow = Math.max(12, Math.min(rect.left + rect.width / 2 - left, pw - 12));
    pop.style.setProperty("--arrow-left", `${arrow}px`);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.classList.toggle("above", above);
  }

  function show(btn, shouldPin = false) {
    clearTimeout(hoverTimer);
    document.querySelectorAll(".help-icon.active").forEach(x => {
      if (x !== btn) x.classList.remove("active");
    });

    active = btn;
    pinned = shouldPin;
    btn.classList.toggle("active", pinned);

    pop.textContent = btn.dataset.help || "";
    pop.classList.remove("hidden");
    requestAnimationFrame(() => position(btn));
  }

  function hide(force = false) {
    if (pinned && !force) return;
    clearTimeout(hoverTimer);
    if (active) active.classList.remove("active");
    active = null;
    pinned = false;
    pop.classList.add("hidden");
  }

  document.querySelectorAll(".help-icon").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      if (!pinned) show(btn, false);
    });
    btn.addEventListener("mouseleave", () => {
      if (!pinned) hoverTimer = setTimeout(() => hide(true), 80);
    });
    btn.addEventListener("focus", () => {
      if (!pinned) show(btn, false);
    });
    btn.addEventListener("blur", () => {
      if (!pinned) hide(true);
    });
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (active === btn && pinned) {
        hide(true);
      } else {
        show(btn, true);
      }
    });
  });

  document.addEventListener("click", e => {
    if (pinned && !e.target.closest(".help-icon")) hide(true);
  });

  window.addEventListener("resize", () => {
    if (active) position(active);
  });
  window.addEventListener("scroll", () => {
    if (active && pinned) position(active);
    else if (active) hide(true);
  }, true);
}

function initAdvancedSettingsState(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  const saved = localStorage.getItem(key);
  el.open = saved === "1";
  el.addEventListener("toggle", () => {
    localStorage.setItem(key, el.open ? "1" : "0");
  });
}

initHelpTips();
initAdvancedSettingsState("advancedSettings","gameAlpiAdvancedMultiOpen");
