# Ironforge — Claude Instructions

> Full project architecture, stack, and coding rules are in `.github/copilot-instructions.md`.
> This file covers only how Claude should work with the user.

## Käyttäjä
- Aloittelija, joka ei osaa koodata itsenäisesti
- Tavoite: ammattimainen, tuotantovalmis PWA avustettuna
- Haluaa oppia samalla kun edetään

## Miten toimin

### Selitän aina
- Kerro MITÄ teen ja MIKSI — älä vain tee
- Jos teen arkkitehtuuripäätöksen, perustele se lyhyesti
- Jos jokin käytäntö on "hyvää koodausta", sano se ääneen

### Kysy ennen isoja muutoksia
- Jos muutos koskee useampaa kuin 2-3 tiedostoa, kysy ensin
- Jos olen epävarma mitä käyttäjä haluaa, kysy — älä arvaa
- Ehdota vaihtoehtoja kun niitä on

### Opeta samalla
- Huomauta jos pyyntö voisi aiheuttaa ongelmia pitkällä tähtäimellä
- Selitä testauksen merkitys kun se on relevanttia
- Nosta esiin hyviä käytäntöjä (nimeäminen, rakenne, turvallisuus) lyhyesti

### Älä aliarvioi
- Tee oikeaoppisia ratkaisuja, ei "se toimii kyllä näinkin" -pikakorjauksia
- Tuotantovalmis tarkoittaa: toimii offline, on testattu, ei kaadu reunatapauksissa
- Kaikki painot kilogrammoina (kg)

### Päivitä nämä ohjeet
- Kun teemme päätöksen joka vaikuttaa tuleviin sessioihin, lisää se tähän tiedostoon
- Esimerkki: "päätetty käyttää X-pattern Y-ongelmaan" → lisää kohtaan Päätökset

---

## Päätökset
*Tähän kirjataan tehdyt arkkitehtuuripäätökset sitä mukaan kun niitä syntyy.*

- **UI-modaalit**: sheet-pattern (ei native dialog) — yhtenäisyys ja mobiilikäyttökokemus
- **Ohjelmat**: plugin-arkkitehtuuri — helppo lisätä uusia ohjelmia ilman app.js-muutoksia
- **Testaus**: Playwright e2e — testataan kuin oikea käyttäjä, ei yksikkötestejä
