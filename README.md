# felles

Delte filer for fagsidene (matematikk, naturfag og eventuelt flere).
Hver fil finnes bare her. Fagsidene henter dem gjennom en omskriving i sin egen `netlify.toml`,
slik at stiene i spillene fortsatt er `./js/...` og nettleseren ser det som samme domene.

## Innhold

- `js/firebase-config.js` – oppkobling mot Firebase (rom, timekoder, poeng)
- `js/spill-utils.js` – timekode, romtilkobling, poeng, meldinger
- `js/touch-dnd.js` – dra og slipp på berøringsskjerm
- `js/gemini-api.js` – kall mot KI-tjenesten

## Slik kobler en fagside seg på

Legg dette i fagsidens `netlify.toml`, og slett `js/`-mappen i det repoet:

    [[redirects]]
      from = "/js/*"
      to = "https://felles.netlify.app/js/:splat"
      status = 200
      force = true

`force = true` gjør at fellesfilene alltid brukes, også om det ligger en gammel kopi igjen i repoet.

## Når en fil endres

Endre den her, og alle fagsidene får endringen med en gang. Filene mellomlagres i fem minutter.
Før du endrer noe, husk at alle spillene på alle sidene bruker de samme filene.
