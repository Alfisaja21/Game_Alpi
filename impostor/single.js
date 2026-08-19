const $=id=>document.getElementById(id);
const screens=["singleSetup","singlePass","singleRole","singleDiscuss","singleRealLife","singleVotePass","singleVote","singleResult","singleFinal"];
const STORE="gameAlpiSingleV9";
const ALL=["Hewan","Benda","Tempat","Makanan","Buah","Kendaraan","Pekerjaan","Olahraga"];
function esc(v){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function maxImp(n){return n<3?1:1+Math.floor((n-3)/3)}
const words=[
{w:"Kucing",c:"Hewan",q:["Bulu","Mengeong","Peliharaan"]},{w:"Harimau",c:"Hewan",q:["Belang","Hutan","Pemangsa"]},{w:"Gajah",c:"Hewan",q:["Belalai","Besar","Afrika"]},{w:"Kelinci",c:"Hewan",q:["Telinga","Lompat","Wortel"]},
{w:"Pantai",c:"Tempat",q:["Air","Pasir","Ombak"]},{w:"Gunung",c:"Tempat",q:["Tinggi","Dingin","Mendaki"]},{w:"Bandara",c:"Tempat",q:["Perjalanan","Terminal","Udara"]},{w:"Sekolah",c:"Tempat",q:["Belajar","Kelas","Guru"]},
{w:"Payung",c:"Benda",q:["Hujan","Pegangan","Lipat"]},{w:"Kamera",c:"Benda",q:["Foto","Lensa","Memotret"]},{w:"Kulkas",c:"Benda",q:["Dingin","Dapur","Simpan"]},{w:"Bantal",c:"Benda",q:["Lembut","Tidur","Kepala"]},
{w:"Bakso",c:"Makanan",q:["Kuah","Bulat","Daging"]},{w:"Rendang",c:"Makanan",q:["Rempah","Daging","Padang"]},{w:"Sate",c:"Makanan",q:["Tusuk","Bakar","Daging"]},{w:"Soto",c:"Makanan",q:["Kuah","Rempah","Mangkok"]},
{w:"Mangga",c:"Buah",q:["Manis","Pohon","Kuning"]},{w:"Apel",c:"Buah",q:["Renyah","Bulat","Merah"]},{w:"Durian",c:"Buah",q:["Berduri","Aroma","Krim"]},{w:"Semangka",c:"Buah",q:["Berair","Biji","Merah"]},
{w:"Mobil",c:"Kendaraan",q:["Empat roda","Setir","Jalan"]},{w:"Kereta",c:"Kendaraan",q:["Rel","Gerbong","Stasiun"]},{w:"Pesawat",c:"Kendaraan",q:["Langit","Perjalanan","Sayap"]},{w:"Kapal",c:"Kendaraan",q:["Laut","Pelabuhan","Berlayar"]},
{w:"Dokter",c:"Pekerjaan",q:["Pasien","Perawatan","Obat"]},{w:"Guru",c:"Pekerjaan",q:["Sekolah","Mengajar","Murid"]},{w:"Pilot",c:"Pekerjaan",q:["Kokpit","Udara","Perjalanan"]},{w:"Koki",c:"Pekerjaan",q:["Dapur","Masak","Restoran"]},
{w:"Sepak Bola",c:"Olahraga",q:["Bola","Gawang","Lapangan"]},{w:"Badminton",c:"Olahraga",q:["Raket","Kok","Net"]},{w:"Renang",c:"Olahraga",q:["Air","Kolam","Gaya"]},{w:"Tinju",c:"Olahraga",q:["Ring","Sarung tangan","Pukul"]}];

let st={players:[],imp:1,roles:[],roleI:0,voteI:0,votes:{},chosen:null,word:null,matchOver:false,phase:"singleSetup",cats:[...ALL],revealed:false};
function save(){localStorage.setItem(STORE,JSON.stringify(st))}
function load(){try{const r=localStorage.getItem(STORE);if(r)st={...st,...JSON.parse(r)}}catch{}}
function show(id){screens.forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden");st.phase=id;save()}
function cats(){return [...$("singleCategoryGrid").querySelectorAll("input:checked")].map(x=>x.value)}
function setCats(a){const z=new Set(a);$("singleCategoryGrid").querySelectorAll("input").forEach(x=>x.checked=z.has(x.value));summary()}
function summary(){$("singleCategorySummary").textContent=cats().length?`${cats().length} kategori aktif`:"Tidak ada kategori"}
function updateImp(){const m=maxImp(st.players.length);st.imp=Math.max(1,Math.min(st.imp,m));$("singleImp").textContent=st.imp;$("singleImpHelp").textContent=`${st.imp} impostor dari ${st.players.length} pemain`;$("singleMinus").disabled=st.imp<=1;$("singlePlus").disabled=st.imp>=m}
function render(){$("singlePlayers").innerHTML=st.players.map((p,i)=>`<div class="player-row"><div class="player-left"><div class="avatar">${esc(p.name[0].toUpperCase())}</div><div><div class="player-name">${esc(p.name)}</div><div class="you">${p.score||0} poin</div></div></div><button class="remove-single" data-i="${i}">Hapus</button></div>`).join("");$("singlePlayers").querySelectorAll(".remove-single").forEach(b=>b.onclick=()=>{st.players.splice(+b.dataset.i,1);render();save()});updateImp()}
function pickWord(){const p=words.filter(x=>st.cats.includes(x.c));return p[Math.floor(Math.random()*p.length)]}
function scoreRows(){return st.players.map(p=>({name:p.name,score:p.score||0})).sort((a,b)=>b.score-a.score)}
function drawScore(t){t.innerHTML=scoreRows().map((p,i)=>`<div class="score-row"><div class="score-left"><span class="rank">${i+1}</span><span class="score-name">${esc(p.name)}</span></div><span class="score-points">${p.score} poin</span></div>`).join("")}

function start(){st.cats=cats();$("singleMsg").textContent="";if(st.players.length<3){$("singleMsg").textContent="Minimal 3 pemain.";return}if(!st.cats.length){$("singleMsg").textContent="Pilih minimal 1 kategori.";return}st.word=pickWord();const idx=[...st.players.keys()].sort(()=>Math.random()-.5),imps=new Set(idx.slice(0,st.imp));st.roles=st.players.map((p,i)=>({name:p.name,role:imps.has(i)?"impostor":"civilian",clue:[...st.word.q].sort(()=>Math.random()-.5).slice(0,2),alive:true}));st.roleI=0;st.voteI=0;st.votes={};st.matchOver=false;st.revealed=false;save();pass()}
function pass(){$("passName").textContent=st.roles[st.roleI].name;show("singlePass")}
function openRole(){const r=st.roles[st.roleI];$("rolePlayer").textContent=r.name;$("localRoleCard").classList.toggle("impostor",r.role==="impostor");$("localRoleName").textContent=r.role==="impostor"?"IMPOSTOR":"Warga";$("localCategory").textContent=st.word.c;$("localSecretLabel").textContent=r.role==="impostor"?"CLUE":"KATA RAHASIA";$("localSecret").textContent=r.role==="impostor"?r.clue.join(" • "):st.word.w;$("localDesc").textContent=r.role==="impostor"?"Kamu adalah Impostor. Kamu tidak tahu kata rahasianya.":"Fokus pada kata rahasia di atas. Jangan sebut katanya secara langsung.";show("singleRole")}
function hideRole(){st.roleI++;save();if(st.roleI>=st.roles.length)show("singleDiscuss");else pass()}

function beginVote(){st.voteI=0;st.votes={};while(st.voteI<st.roles.length&&!st.roles[st.voteI].alive)st.voteI++;save();votePass()}
function votePass(){$("votePassName").textContent=st.roles[st.voteI].name;show("singleVotePass")}
function openVote(){st.chosen=null;$("saveLocalVote").disabled=true;$("voteName").textContent=st.roles[st.voteI].name;$("localVoteOptions").innerHTML=st.roles.map((p,i)=>(i===st.voteI||!p.alive)?"":`<button class="vote-option" data-i="${i}"><span class="vote-radio"></span><span class="vote-avatar">${esc(p.name[0].toUpperCase())}</span><span class="vote-player-name">${esc(p.name)}</span></button>`).join("");$("localVoteOptions").querySelectorAll(".vote-option").forEach(b=>b.onclick=()=>{$("localVoteOptions").querySelectorAll(".vote-option").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");st.chosen=+b.dataset.i;$("saveLocalVote").disabled=false;save()});show("singleVote")}
function saveVote(){st.votes[st.voteI]=st.chosen;st.voteI++;while(st.voteI<st.roles.length&&!st.roles[st.voteI].alive)st.voteI++;save();if(st.voteI>=st.roles.length)result();else votePass()}
function result(){const counts={};Object.values(st.votes).forEach(i=>counts[i]=(counts[i]||0)+1);const rows=Object.entries(counts).map(([i,v])=>[+i,v]).sort((a,b)=>b[1]-a[1]),top=rows[0]?.[1]||0,tops=rows.filter(x=>x[1]===top),tie=tops.length!==1,elim=tie?null:st.roles[tops[0][0]];if(elim)elim.alive=false;Object.entries(st.votes).forEach(([v,t])=>{if(st.roles[t].role==="impostor")st.players[v].score=(st.players[v].score||0)+25});const ai=st.roles.filter(r=>r.alive&&r.role==="impostor").length,ac=st.roles.filter(r=>r.alive&&r.role==="civilian").length;let win="continue";if(ai===0){win="civilian";st.matchOver=true}else if(ai>=ac){win="impostor";st.matchOver=true}else st.matchOver=false;if(st.matchOver)st.roles.forEach((r,i)=>{if(win==="civilian"&&r.role==="civilian")st.players[i].score+=100;if(win==="impostor"&&r.role==="impostor")st.players[i].score+=200});$("localWinner").textContent=st.matchOver?(win==="civilian"?"Warga Menang Pertandingan!":"Impostor Menang Pertandingan!"):"Ronde Selesai";$("localElim").textContent=tie?"Voting Seri":elim.name;$("localDetail").textContent=tie?"Tidak ada eliminasi.":`${elim.name} adalah ${elim.role==="impostor"?"IMPOSTOR":"WARGA"}.`;$("localWord").textContent=st.matchOver?st.word.w:"Tetap rahasia";$("localCatResult").textContent=st.word.c;$("localAgain").textContent=st.matchOver?"Main Lagi":"Lanjut Diskusi";drawScore($("localScore"));save();show("singleResult")}

function realLife(){st.revealed=false;$("realLifeConfirmBox").classList.remove("hidden");$("realLifeRevealBox").classList.add("hidden");show("singleRealLife")}
function reveal(){if(!confirm("Yakin voting real life sudah selesai? Identitas Impostor akan dibuka."))return;$("realLifeImpostors").textContent=st.roles.filter(r=>r.role==="impostor").map(r=>r.name).join(", ");$("realLifeWord").textContent=st.word.w;$("realLifeConfirmBox").classList.add("hidden");$("realLifeRevealBox").classList.remove("hidden");st.revealed=true;save()}
function realFinish(win){if(!st.revealed)return;st.roles.forEach((r,i)=>{if(win==="civilian"&&r.role==="civilian")st.players[i].score=(st.players[i].score||0)+100;if(win==="impostor"&&r.role==="impostor")st.players[i].score=(st.players[i].score||0)+200});st.matchOver=true;$("localWinner").textContent=win==="civilian"?"Warga Menang!":"Impostor Menang!";$("localElim").textContent="Voting Real Life";$("localDetail").textContent="Hasil ronde ditentukan berdasarkan voting langsung.";$("localWord").textContent=st.word.w;$("localCatResult").textContent=st.word.c;$("localAgain").textContent="Main Lagi";drawScore($("localScore"));save();show("singleResult")}
function again(){if(st.matchOver){st.roles=[];st.word=null;st.roleI=0;st.voteI=0;st.votes={};st.revealed=false;save();render();show("singleSetup")}else show("singleDiscuss")}
function finish(){$("localPodium").innerHTML=scoreRows().map((p,i)=>`<div class="podium-row"><span class="podium-name">${i===0?"🏆 ":""}${i+1}. ${esc(p.name)}</span><span class="podium-score">${p.score} poin</span></div>`).join("");show("singleFinal")}

$("addPlayer").onclick=()=>{const n=$("singleName").value.trim().replace(/\s+/g," ").slice(0,20);if(!n||st.players.some(p=>p.name.toLowerCase()===n.toLowerCase()))return;st.players.push({name:n,score:0});$("singleName").value="";render();save()};
$("singleMinus").onclick=()=>{if(st.imp>1)st.imp--;updateImp();save()};$("singlePlus").onclick=()=>{st.imp++;updateImp();save()};
$("singleStart").onclick=start;$("openRole").onclick=openRole;$("hideRole").onclick=hideRole;$("beginLocalVote").onclick=beginVote;$("beginRealLifeVote").onclick=realLife;$("revealRealLife").onclick=reveal;$("realLifeCivilianWin").onclick=()=>realFinish("civilian");$("realLifeImpostorWin").onclick=()=>realFinish("impostor");$("openLocalVote").onclick=openVote;$("saveLocalVote").onclick=saveVote;$("localAgain").onclick=again;$("localFinish").onclick=finish;
$("singleSelectAll").onclick=()=>{st.cats=[...ALL];setCats(st.cats);save()};$("singleClearAll").onclick=()=>{st.cats=[];setCats([]);save()};$("singleCategoryGrid").querySelectorAll("input").forEach(x=>x.onchange=()=>{st.cats=cats();summary();save()});
$("singleFinishBack").onclick=()=>localStorage.removeItem(STORE);

load();setCats(st.cats?.length?st.cats:ALL);render();
if(st.phase==="singlePass"&&st.roles.length)pass();
else if(st.phase==="singleRole"&&st.roles.length)openRole();
else if(st.phase==="singleDiscuss"&&st.roles.length)show("singleDiscuss");
else if(st.phase==="singleRealLife"&&st.roles.length){show("singleRealLife");if(st.revealed){$("realLifeConfirmBox").classList.add("hidden");$("realLifeRevealBox").classList.remove("hidden");$("realLifeImpostors").textContent=st.roles.filter(r=>r.role==="impostor").map(r=>r.name).join(", ");$("realLifeWord").textContent=st.word?.w||"-"}}
else if(st.phase==="singleVotePass"&&st.roles.length)votePass();
else if(st.phase==="singleVote"&&st.roles.length)openVote();
else if(st.phase==="singleResult"){drawScore($("localScore"));show("singleResult")}
else if(st.phase==="singleFinal")finish();
else show("singleSetup");
