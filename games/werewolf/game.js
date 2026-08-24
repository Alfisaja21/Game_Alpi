
function goBack(){
window.location.href="../../index.html";
}

const join=document.querySelector('.join');
const modal=document.getElementById('joinModal');

join.onclick=()=>{modal.style.display='flex';};
