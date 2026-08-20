const players=[
{name:'Alfi',role:'Werewolf',alive:true},
{name:'Budi',role:'Villager',alive:true},
{name:'Rina',role:'Seer',alive:true},
{name:'Sinta',role:'Doctor',alive:true}
];

let phase='Malam';

function render(){
document.getElementById('phase').innerText=phase;
playersEl=document.getElementById('players');
playersEl.innerHTML='';
players.forEach(p=>{
playersEl.innerHTML+=`<div class='player'>${p.name}<br>${p.alive?'🟢':'💀'}</div>`;
});
}
render();

document.getElementById('roleBtn').onclick=()=>{
alert('Role kamu: '+players[0].role);
};

document.getElementById('nextBtn').onclick=()=>{
if(phase==='Malam'){
phase='Diskusi';
narration.innerText='☀️ Pagi tiba. Warga berdiskusi.';
}else if(phase==='Diskusi'){
phase='Voting';
narration.innerText='⚖️ Voting rahasia dimulai.';
}else{
phase='Malam';
narration.innerText='🌙 Semua warga tidur.';
}
document.getElementById('log').innerHTML+='Fase: '+phase+'<br>';
render();
};
