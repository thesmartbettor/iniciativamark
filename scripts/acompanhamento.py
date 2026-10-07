"""Acompanhamento real da Estratégia MARK a partir de 01/11/2026.

Carteira de R$100 mil que segue o sinal de data/sinais.json: no 1º pregão de cada mês volta ao peso do mês
(BOVA11 + Tesouro Selic), comprando e vendendo no fechamento. Benchmarks com R$100 mil no mesmo dia:
Tesouro Selic (Selic diária, BCB SGS 11), Ibovespa (^BVSP) e SMAL11. Valores brutos, antes de IR e custos.
Roda no GitHub Actions todo dia útil e grava data/acompanhamento.json.
"""
import json, sys, datetime as dt
from pathlib import Path
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
INICIO = pd.Timestamp("2026-11-01")
CAPITAL = 100_000.0
NOMES = ["MARK", "Tesouro Selic", "Ibovespa", "SMAL11"]


def baixar_precos(inicio):
    import yfinance as yf
    tick = {"BOVA11": "BOVA11.SA", "SMAL11": "SMAL11.SA", "IBOV": "^BVSP"}
    df = yf.download(list(tick.values()), start=(inicio - pd.Timedelta(days=10)).strftime("%Y-%m-%d"),
                     auto_adjust=False, progress=False)["Close"]
    df = df.rename(columns={v: k for k, v in tick.items()})
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    return df[list(tick)].dropna(how="all")


def baixar_selic(inicio, fim):
    import requests
    url = ("https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json"
           f"&dataInicial={(inicio - pd.Timedelta(days=10)):%d/%m/%Y}&dataFinal={fim:%d/%m/%Y}")
    r = requests.get(url, timeout=30, headers={"User-Agent": "iniciativamark"})
    r.raise_for_status()
    s = pd.DataFrame(r.json())
    return pd.Series(s.valor.astype(float).values / 100, index=pd.to_datetime(s.data, dayfirst=True))


def simular(px, selic, sinais, inicio=INICIO, capital=CAPITAL):
    """px: fechamentos diários (BOVA11, SMAL11, IBOV); selic: taxa diária (fração) por data.
    A Selic da data d rende de d para o próximo pregão. Retorna DataFrame de valores e lista de rebalanceamentos."""
    px = px[px.index >= inicio].dropna(subset=["BOVA11"]).ffill()
    if px.empty:
        return None, []
    selic = selic.sort_index()
    dias = px.index
    val, reb = {}, []
    cotas = rf = None
    bench = {"Tesouro Selic": capital}
    peso_ant, mes_ant = None, None
    for i, d in enumerate(dias):
        if i > 0:
            ant = dias[i - 1]
            janela = selic[(selic.index >= ant) & (selic.index < d)]
            if len(janela):
                fator = float((1 + janela).prod())
            else:  # taxa do dia ainda não publicada: usa a última conhecida
                fator = 1 + (float(selic.iloc[-1]) if len(selic) else 0.0)
            rf *= fator
            bench["Tesouro Selic"] *= fator
        mes = d.strftime("%Y-%m")
        if mes != mes_ant:
            s = sinais.get(mes)
            peso = s["bova11"] if s else peso_ant
            total = capital if cotas is None else cotas * px.BOVA11[d] + rf
            if peso is None:
                raise SystemExit(f"Sem sinal para {mes} em data/sinais.json")
            cotas = total * peso / px.BOVA11[d]
            rf = total - cotas * px.BOVA11[d]
            reb.append({"data": str(d.date()), "mes": mes, "bova11": round(peso, 4), "sinal_do_mes": bool(s),
                        "valor": round(float(total), 2)})
            peso_ant, mes_ant = peso, mes
        val[d] = {"MARK": cotas * px.BOVA11[d] + rf, "Tesouro Selic": bench["Tesouro Selic"],
                  "Ibovespa": capital * px.IBOV[d] / px.IBOV.iloc[0], "SMAL11": capital * px.SMAL11[d] / px.SMAL11.iloc[0],
                  "_cotas": cotas, "_rf": rf, "_bova": px.BOVA11[d]}
    return pd.DataFrame(val).T, reb


def montar_json(v, reb, agora):
    base = {"inicio": str(INICIO.date()), "capital": CAPITAL, "atualizado_em": agora,
            "nota": "Valores brutos, antes de imposto de renda e custos de corretagem e custódia."}
    if v is None:
        return {**base, "status": "aguardando"}
    ult = v.index[-1]
    mens = v[NOMES].resample("ME").last()
    mens = pd.concat([pd.DataFrame([{n: CAPITAL for n in NOMES}], index=[v.index[0] - pd.Timedelta(days=1)]), mens])
    ret_m = mens.pct_change().dropna()
    return {**base, "status": "ativo", "ultimo_pregao": str(ult.date()),
            "datas": [str(d.date()) for d in v.index],
            "series": {n: [round(float(x), 2) for x in v[n]] for n in NOMES},
            "mensal": {"meses": [d.strftime("%Y-%m") for d in ret_m.index],
                       "series": {n: [round(float(x) * 100, 2) for x in ret_m[n]] for n in NOMES}},
            "posicao": {"bova11_cotas": round(float(v._cotas.iloc[-1]), 4), "bova11_preco": round(float(v._bova.iloc[-1]), 2),
                        "bova11_valor": round(float(v._cotas.iloc[-1] * v._bova.iloc[-1]), 2),
                        "selic_valor": round(float(v._rf.iloc[-1]), 2)},
            "rebalanceamentos": reb}


def main():
    sinais = json.loads((RAIZ / "data/sinais.json").read_text())["meses"]
    hoje = pd.Timestamp.now(tz="America/Sao_Paulo").tz_localize(None).normalize()
    agora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).strftime("%Y-%m-%d %H:%M")
    if hoje < INICIO:
        v, reb = None, []
    else:
        px = baixar_precos(INICIO)
        try:
            selic = baixar_selic(INICIO, hoje)
        except Exception as e:  # BCB fora do ar: mantém a última taxa conhecida do arquivo anterior
            print("Aviso: Selic indisponível:", e, file=sys.stderr)
            antigo = RAIZ / "data/selic_cache.json"
            c = json.loads(antigo.read_text()) if antigo.exists() else {}
            selic = pd.Series(c, dtype=float); selic.index = pd.to_datetime(selic.index)
        if len(selic):
            (RAIZ / "data/selic_cache.json").write_text(json.dumps({str(k.date()): v for k, v in selic.items()}))
        v, reb = simular(px, selic, sinais)
    out = montar_json(v, reb, agora)
    (RAIZ / "data/acompanhamento.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(out["status"], out.get("ultimo_pregao"), {n: out["series"][n][-1] for n in NOMES} if v is not None else "")


if __name__ == "__main__":
    main()
