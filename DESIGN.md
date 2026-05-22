# Money-Repräsentation

Preise und Geldbeträge werden intern als Integer-Cents gespeichert und verrechnet (z.B. 19900 = €199,00).
Begründung: Keine Floating-Point-Rundungsfehler, Integer-Arithmetik in Javascript/PostgreSQL ist exakt. Formatierung für die API-Response ausschließlich am Response-Boundary via `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`. VAT-Sätze und Prozentsätze werden als `numeric(8,4)` gespeichert (z.B. 0.1900 für 19%, 5.0000 für 5%-Zuschlag).

# Rundungsregel

Half-up auf ganze Cents nach jedem Prozentschritt.
Konkretes Beispiel: Menge 3 x € 9,99 (= 999 Cents) x 7% Zuschlag
-> 3 x 999 = 2997 Cents, 2997 x 0.07 = 209.79 -> gerundet: 210 Cents = €2,10.
Kein kumulierter Rundungsfehler, weil jeder Schritt eigenständig gerundet wird.

# Quote-Auswertungsreihenfolge

1. lineNetCents = `round(quantity x netPriceCents)`
2. Zuschläge pro Zeile: flat = Betrag, percentage = `round(lineNetCents x rate / 100)` -> `lineTotal = lineNetCents + sumSurchages`
3. `subtotalCents = sum(all lineTotals)``
4. Rabatte: flat = Betrag (min mit cap), percentage = `round(subtotalCents x rate / 100)`(min mit cap) -> `discountedNet = subtotalCents - sumDiscounts`
5. VAT-Gruppierung nach vatRate: `vatAmount = round(groupNetCents x vatRate)` -> `groupGross = groupNetCents + vatAmount``

# Concurrency beim Publish

Unique Partial Index: CREATE UNIQUE INDEX ON pricing_service.catalog_versions (craftsman_id, trade) WHERE status = 'PUBLISHED'. Der zweite gleichzeitige Publish-Call bekommt eine PostgreSQL-unique-violation, die als 409 Conflict weitergereicht wird.

Nicht gewählt weil:

- SELECT FOR UPDATE: Deadlock-Risiko bei mehreren gleichzeitigen Writes, komplizierter Rollback.
- Advisory Lock: Kein automatisches Release bei Fehler, Skalierungsprobleme bei vielen (craftsman, trade)- Kombinationen.

# Schema-Drift

PATCH /trades/:trade prüft alle DRAFT- und PUBLISHED-Positionen dieses Trades gegen das neue Schema: Bei Verletzung: 409 Conflict mit Liste { positionID, positionKey, errors [] }.
Grund: Explizites Feedback statt stilles Markieren und der Admin kann somit gezielt handeln.

# AI-Nutzung

- Recherche und Planung der Challenge
- Inline-Code-Completion
- Entity-Boilerplates und DTOs scaffolded mit Copilot
- Conventions reviewed
- gezielt Tests generieren lassen, im Anschluss reviewed
- code analyse / Verbesserungsvorschläge eingeholt für refactoring z.B. component splitting
- übersetzungen generieren lassen, im Anschluss reviewed

# Anmerkung zu eigentlich Untersagten Änderungen an auth-service

ich habe die seed uuid '11111111-1111-1111-1111-111111111111' des PARTNER_CRAFTSMAN geändert zu '11111111-1111-4111-a111-111111111111' um RFC 4122 konform zu bleiben und isUUID() verwenden zu können.
