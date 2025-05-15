from flask import Flask, render_template, request, jsonify
import json
import os
from collections import Counter, defaultdict
import random
from dotenv import load_dotenv

load_dotenv()
print (os.getenv("ORACLE_USER"))

app = Flask(__name__)

# Generování 100 pojistných událostí
kraje = [
    "Praha", "Středočeský", "Jihočeský", "Plzeňský", "Karlovarský",
    "Ústecký", "Liberecký", "Královéhradecký", "Pardubický", "Vysočina",
    "Jihomoravský", "Olomoucký", "Zlínský", "Moravskoslezský"
]

pojistne_udalosti = [
    {
        "id": i + 1,
        "lat": round(random.uniform(48.5, 51.1), 6),
        "lon": round(random.uniform(12.1, 18.9), 6),
        "popis": f"Udalost {i + 1}"
    }
    for i in range(100)
]

# Generování 25 mobilních techniků
odbornosti = ["MAJ", "PMV", "MAJ,PMV"]
prijmeni = ["Novák", "Svoboda", "Novotný", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý"]
jmena = ["Jan", "Petr", "Martin", "Josef", "Tomáš", "Jaroslav", "Miroslav"]

mobilni_technici_obj = []

for i in range(25):
    technik = {
        "tia_kod": f"TIA{i+1:03}",
        "prijmeni": random.choice(prijmeni),
        "jmeno": random.choice(jmena),
        "odbornost": random.choice(odbornosti),
        "region": random.choice(kraje)
    }
    mobilni_technici_obj.append(technik)

# Pouze jména pro současný kód (zachováme strukturu pro zobrazení)
mobilni_technici = [f"{t['prijmeni']} {t['jmeno']}" for t in mobilni_technici_obj]

# Náhodné přiřazení 10 událostí k technikům
prirazeni = {
    i + 1: random.choice(mobilni_technici) for i in random.sample(range(100), 10)
}

@app.route('/')
def mapa():
    enriched = []
    for udalost in pojistne_udalosti:
        enriched.append({**udalost, "technik": prirazeni.get(udalost['id'])})

    technik_summary = Counter(prirazeni.values())
    region_summary = defaultdict(lambda: {"pocet": 0, "technici": []})

    for t in mobilni_technici_obj:
        cele_jmeno = f"{t['prijmeni']} {t['jmeno']}"
        pocet = technik_summary.get(cele_jmeno, 0)
        region_summary[t['region']]['technici'].append({
            "jmeno": cele_jmeno,
            "tia_kod": t['tia_kod'],
            "odbornost": t['odbornost'],
            "region": t['region'],
            "pocet": pocet
        })
        region_summary[t['region']]['pocet'] += pocet

    return render_template(
        'mapa.html',
        pojistne_udalosti=enriched,
        technici=mobilni_technici,
        region_info=dict(region_summary)
    )

@app.route('/priradit', methods=['POST'])
def priradit():
    data = request.json
    ids = data.get('udalost_id')
    technik = data.get('technik')

    if not isinstance(ids, list):
        ids = [ids]

    for udalost_id in ids:
        if technik is None:
            prirazeni.pop(int(udalost_id), None)
        else:
            prirazeni[int(udalost_id)] = technik

    return jsonify(status='success', prirazeni=prirazeni)

if __name__ == '__main__':
    app.run(debug=True)
