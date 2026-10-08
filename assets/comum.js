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

/* Calculadora: montante -> cotas de BOVA11 (pela alocação vigente) e o restante em Tesouro Selic */
const numBR = s => +String(s).replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,"");
function calculadora(el){
  el.innerHTML = '<p class="meta" data-c="aloc" style="margin-top:0">Carregando a alocação do mês…</p>' +
    '<div class="filtro-campos"><label>Quanto você tem para investir (R$) <input type="text" inputmode="numeric" data-c="valor" value="10.000"></label>' +
    '<label>Preço de uma cota de BOVA11 (R$) <input type="text" inputmode="decimal" data-c="preco" placeholder="ex.: 150,00"></label></div>' +
    '<p class="meta" data-c="fonte" style="margin:8px 0 0"></p><div class="kpis" data-c="res"></div>' +
    '<p class="meta" style="margin:0">Arredonda para baixo o número de cotas, porque não dá para comprar fração de cota de BOVA11. O que sobra vai para o Tesouro Selic. Não inclui custos nem impostos. Não é recomendação de investimento.</p>';
  const q = k => el.querySelector('[data-c="'+k+'"]'), V = q("valor"), P = q("preco");
  Promise.all([carregar("data/sinais.json"), carregar("data/preco_bova11.json").catch(() => null)]).then(([S, PR]) => {
    const meses = Object.keys(S.meses).sort(), k = meses[meses.length-1], b = S.meses[k].bova11;
    q("aloc").innerHTML = "Alocação vigente em " + mesBR(k) + ": <b>" + pct(b,0) + " em BOVA11</b> e <b>" + pct(1-b,0) + " em Tesouro Selic</b>.";
    if (PR && PR.preco) { P.value = PR.preco.toLocaleString("pt-BR",{minimumFractionDigits:2}); q("fonte").textContent = "Preço de fechamento do BOVA11 em " + dataBR(PR.data) + ". Troque pelo preço que aparece no seu aplicativo na hora da compra."; }
    function calc(){
      const v = numBR(V.value), p = numBR(P.value), res = q("res");
      if (!(v > 0)) { res.innerHTML = ""; return; }
      const alvo = v * b, cotas = p > 0 ? Math.floor(alvo / p) : null, emBova = cotas === null ? alvo : cotas * p, selic = v - emBova;
      res.innerHTML =
        '<div class="kpi"><span class="nome"><span class="dot" style="background:var(--s-bova)"></span>BOVA11</span><b>' + (cotas === null ? "–" : nf0.format(cotas) + " cotas") + '</b><span>' + (cotas === null ? "informe o preço da cota" : "cerca de " + reais(emBova)) + '</span></div>' +
        '<div class="kpi"><span class="nome"><span class="dot" style="background:var(--s-selic)"></span>Tesouro Selic</span><b>' + reais(selic) + '</b><span>' + pct(selic/v,0) + ' do total</span></div>';
    }
    V.oninput = calc; P.oninput = calc; calc();
  });
}
