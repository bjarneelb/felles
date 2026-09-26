# felles

Delte filer for fagsidene (matematikk, naturfag og eventuelt flere). Hver fil finnes bare her.
Publiseres på https://fellesting.netlify.app

## Innhold

- `js/spill-utils.js` – spillernavn (nickname), timekode-rapport, rom, poeng, meldinger, nivålogikk
- `js/firebase-config.js` – oppkobling mot Firebase
- `js/touch-dnd.js` – dra og slipp på berøringsskjerm
- `js/gemini-api.js` – kall mot KI-tjenesten
- `js/logg.js` – logging for verktøy uten poeng
- `js/motorer/` – spillmotorer (begrep, bobler)
- `baner/` – bilbane, fotball og fremdriftsbane
- `laerer.html` – lærerside for alle fag (timekoder, live-oversikt, spillrom, rapport)
- `netlify/functions/` – ai-proxy (rapport) og teacher-auth

## Slik kobler en fagside seg på

Legg dette i fagsidens `netlify.toml`, og slett `js/`- og `baner/`-mappene i det repoet:

    [[redirects]]
      from = "/js/*"
      to = "https://fellesting.netlify.app/js/:splat"
      status = 200
      force = true

    [[redirects]]
      from = "/baner/*"
      to = "https://fellesting.netlify.app/baner/:splat"
      status = 200
      force = true

## Regler for spill som bruker spill-utils.js

- Last `spill-utils.js` i `<head>`, før spillets egen kode.
- Ikke lag egne spillernavn. Bruk `window.playerName` (nickname fra innloggingen).
- Rapporter med `syncToTimecode('spillnavn', {level, startLevel, maxLevel, score, correct, wrong, sessionStart})`.
- Ikke deklarer `const`/`let` med samme navn som funksjonene i `spill-utils.js`.

## Miljøvariabler i Netlify (fellesting)

- `likningsspill_key` – nøkkel for ai-proxy (samme som på matematikksiden)
- `TEACHER_PASSWORD` – brukes av teacher-auth

## Når en fil endres

Endre den her, og alle fagsidene får endringen. Filene mellomlagres i fem minutter.
