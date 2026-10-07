/* Iniciativa MARK: utilitários comuns (cores, formatação, Chart.js) */
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const COR = {"MARK":"--s-mark","Tesouro Selic":"--s-selic","Ibovespa":"--s-bova","Ibovespa (BOVA11)":"--s-bova","SMAL11":"--s-smal","BOVA11":"--s-bova"};
const cor = n => css(COR[n] || "--muted");
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MES_C = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const nf0 = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
const reais = x => "R$ " + nf0.format(x);
const pct = (x, d=1) => (x*100).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}) + "%";
const pp = (x, d=1) => (x>0?"+":"") + x.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}) + "%";
const dataBR = s => s.slice(8,10) + "/" + s.slice(5,7) + "/" + s.slice(0,4);
const mesBR = s => MESES[+s.slice(5,7)-1] + "/" + s.slice(0,4);
const mesC = s => MES_C[+s.slice(5,7)-1] + "/" + s.slice(2,4);
async function carregar(url){ const r = await fetch(url, {cache:"no-cache"}); if(!r.ok) throw new Error(url); return r.json(); }

function baseChart(){
  if(!window.Chart) return;
  Chart.defaults.font.family = css("--f-body"); Chart.defaults.font.size = 12;
  Chart.defaults.color = css("--muted"); Chart.defaults.borderColor = css("--grid");
  Chart.defaults.animation = false; Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = css("--surface");
  Chart.defaults.plugins.tooltip.titleColor = css("--fg"); Chart.defaults.plugins.tooltip.bodyColor = css("--fg");
  Chart.defaults.plugins.tooltip.borderColor = css("--line"); Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.elements.point.radius = 0; Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.interaction = {mode:"index", intersect:false};
}
/* legenda clicável que liga/desliga séries */
function legenda(el, chart, nomes){
  el.innerHTML = "";
  nomes.forEach((n,i) => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed","true");
    b.innerHTML = '<i style="background:'+cor(n)+'"></i>' + n;
    b.onclick = () => { const v = chart.isDatasetVisible(i); chart.setDatasetVisibility(i,!v); b.setAttribute("aria-pressed", String(!v)); chart.update(); };
    el.appendChild(b);
  });
}
baseChart();
