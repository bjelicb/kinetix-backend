# PR Mobile - Automatsko kreiranje PR-a za Kinetix-Mobile

## Opis
Automatski kreira PR sa bunar → master branch za Kinetix-Mobile repo. Komanda koristi lokalni git i gh CLI (već instalirani i ulogovani), proverava i kreira branch bunar ako ne postoji, commit-uje sve lokalne izmene, push-uje na bunar i kreira GitHub PR.

## Instrukcije

1. **Prebaci se na Kinetix-Mobile repo:**
   - Navigiraj do `C:\Users\bjeli\Documents\Kinetix-Mobile`

2. **Proveri da li postoji branch "bunar":**
   - Proveri lokalno: `git branch --list bunar`
     - Parsiraj output: ako je prazan string ili null, branch ne postoji lokalno
     - Ako output sadrži bilo koji tekst (npr. "* bunar" ili "  bunar"), branch postoji lokalno
   - Proveri na remote-u: `git ls-remote --heads origin bunar`
     - Parsiraj output: ako je prazan string ili null, branch ne postoji na remote-u
     - Ako output sadrži bilo koji tekst (npr. hash i "refs/heads/bunar"), branch postoji na remote-u
   - **Logika odlučivanja:**
     - Ako ne postoji ni lokalno ni na remote-u:
       - Prebaci se na master: `git checkout master` (ignoriši greške ako već si na master)
       - Kreiraj novi branch: `git checkout -b bunar`
     - Ako postoji samo na remote-u (ne lokalno):
       - Checkout remote branch: `git checkout -b bunar origin/bunar`
     - Ako postoji lokalno (bez obzira na remote):
       - Prebaci se na njega: `git checkout bunar`

3. **Pregledaj sve lokalne izmene:**
   - Pokreni: `git status --short`
   - Sačuvaj output u promenljivu za kasniju upotrebu
   - Prikaži sve izmene korisniku

4. **Proveri da li postoje izmene za commit:**
   - Pokreni: `git status --porcelain`
   - Proveri da li je output prazan
   - Ako je prazan, obavesti korisnika: "Nema lokalnih izmena za commit!" i završi komandu
   - Ako postoje izmene, nastavi sa sledećim koracima

5. **Dodaj sve izmene:**
   - Pokreni: `git add -A`
   - Ne pitaj korisnika za potvrdu, uradi automatski

5a. **Prikupi git statistiku za analizu:**
   - Pokreni: `git diff --shortstat` (ukupna statistika: "X files changed, Y insertions(+), Z deletions(-)")
   - Pokreni: `git diff --stat` (detaljna statistika po fajlovima)
   - Sačuvaj output-e za analizu

6. **Analiziraj izmene i kreiraj commit:**
   - **Koristi `mcp_sequential-thinking_sequentialthinking`** da analiziraj izmene:
     - Uzmi output iz koraka 3 (`git status --porcelain`) i koraka 5a (`git diff --shortstat`, `git diff --stat`)
     - Kategorizuj izmene po tipu:
       - Testovi: `test/`, `*.test.dart`, `integration_test/`, fajlovi koji sadrže "test" u putanji
       - Dokumentacija: `docs/`, `*.md`, `*.html`
       - Source code: `lib/`, `*.dart` (osim test fajlova)
       - Konfiguracija: `.cursor/`, `*.yaml`, `*.json`, `pubspec.yaml`, `analysis_options.yaml`
     - Identifikuj glavnu promenu (1-2 reči, max 50 karaktera):
       - Primer: "test coverage analysis"
       - Primer: "documentation updates"
       - Primer: "bug fixes and improvements"
       - Primer: "comprehensive test improvements"
     - Generiši kratak opis za commit message (budi specifičan - npr. ako su dominantno testovi, reci "test coverage analysis")
   
   - **Generiši commit message:**
     - Format: `misija: [kratak opis generisan iz analize]`
     - Primer: `misija: test coverage analysis`
     - Primer: `misija: comprehensive test improvements`
     - **KRITIČNO:** Kratak opis MORA biti generisan iz analize, ne fiksna vrednost
   
   - **Generiši commit body:**
     - Prvi red: [Ukratko šta je urađeno - 1-2 rečenice generisane iz analize]
     - Prazan red
     - "Statistika: [broj fajlova] fajlova izmenjeno, [broj] linija dodato, [broj] linija obrisano" (iz `git diff --shortstat`)
     - Prazan red
     - "Kategorije izmena:"
     - Lista kategorija sa brojem fajlova: "- [Kategorija]: X fajlova"
     - Primer:
       ```
       Comprehensive test coverage analysis and improvements across the Mobile codebase.

       Statistika: 85 fajlova izmenjeno, 5234 linija dodato, 123 linija obrisano

       Kategorije izmena:
       - Testovi: 45 fajlova
       - Dokumentacija: 25 fajlova
       - Source code: 12 fajlova
       - Konfiguracija: 3 fajlova
       ```
   
   - Format komande: `git commit -m "misija: [kratak opis]" -m "[commit body tekst]"`

7. **Push na bunar:**
   - Pokreni: `git push -u origin bunar`
   - Ako push ne uspe, prikaži grešku i završi

8. **Kreiraj GitHub PR:**
   - Proveri da li PR već postoji: `gh pr list --head bunar --base master --json number`
   - Parsiraj JSON output i proveri da li postoji PR
   - Ako PR postoji, obavesti korisnika: "PR već postoji (broj: [number])" i završi komandu
   - Ako PR ne postoji:
     - **Title:** Isti kao commit message iz koraka 6 (npr. `misija: test coverage analysis`)
     
     - **Body (detaljna analiza):**
       - Koristi istu analizu iz koraka 6 (kategorije, statistika)
       - Format:
         - [Detaljan opis šta je urađeno - 2-3 rečenice generisane iz analize]
         - Prazan red
         - "## Statistika"
         - "- Fajlova izmenjeno: [broj]"
         - "- Linija dodato: [broj]"
         - "- Linija obrisano: [broj]"
         - Prazan red
         - "## Kategorije izmena"
         - Za svaku kategoriju (Testovi, Dokumentacija, Source code, Konfiguracija):
           - "### [Kategorija] ([broj] fajlova)"
           - Lista svih fajlova iz te kategorije iz `git status --porcelain` output-a, svaka izmena u novom redu sa 2 space-a indentacije
           - Ako je kategorija relevantna, dodaj kratak opis (npr. "Detalji: test coverage improvements, new test files")
         - Prazan red
         - "## Opis"
         - [Detaljniji opis šta je urađeno i zašto - generisano iz analize, 2-3 rečenice]
       
       - Primer body-a:
         ```
         Comprehensive test coverage analysis and improvements across the Mobile codebase, including new test files, improved coverage metrics, and detailed analysis reports.

         ## Statistika
         - Fajlova izmenjeno: 85
         - Linija dodato: 5234
         - Linija obrisano: 123

         ## Kategorije izmena

         ### Testovi (45 fajlova)
           M  test/controllers/analytics_controller_test.dart
           A  test/controllers/analytics_controller_trainer_test.dart
           A  test/services/analytics_service_trainer_test.dart
           ...
           Detalji: Added new test files for trainer analytics, improved coverage for existing controllers

         ### Dokumentacija (25 fajlova)
           A  docs/TEST_COVERAGE/TEST_COVERAGE_ANALYSIS_Flutter.md
           A  docs/TEST_COVERAGE/Kinetix_Visual_Integrity_Dashboard.html
           ...
           Detalji: Added comprehensive test coverage analysis reports and visual dashboard

         ### Source Code (12 fajlova)
           M  lib/services/sync_manager.dart
           M  lib/presentation/controllers/analytics_controller.dart
           ...
           Detalji: Bug fixes and improvements based on test findings

         ### Konfiguracija (3 fajlova)
           M  analysis_options.yaml
           ...

         ## Opis
         This PR includes comprehensive test coverage improvements across the Mobile codebase. Added new test files for trainer analytics, improved coverage metrics, and generated detailed analysis reports with visual dashboards. All test files follow best practices and provide comprehensive coverage of critical functionality.
         ```
     
     - Komanda: `gh pr create --base master --head bunar --title "misija: [kratak opis]" --body "[detaljan body tekst]"`

## Važne napomene

- **SVE se izvršava automatski bez pitanja korisnika** - agent ne sme da pita korisnika ništa tokom izvršavanja
- Koristi lokalni git i gh CLI koji su već instalirani i ulogovani
- Koristi `mcp_sequential-thinking_sequentialthinking` za semantičku analizu izmena u koraku 6
- Ako nema izmena, komanda se završava bez greške (exit 0)
- Ako PR već postoji, komanda se završava bez kreiranja novog
- Za commit body i PR body, koristi PowerShell here-string sintaksu (`@"..."@`) ili escape karaktere (`\n` za novi red)
- Formatiranje liste izmena: svaka linija iz `git status --porcelain` output-a treba da bude u novom redu sa 2 space-a indentacije
- **KRITIČNO:** Commit message i PR title MORA biti generisan iz analize (format: "misija: [kratak opis]"), NE fiksna vrednost "misija"
- **KRITIČNO:** Commit body i PR description MORA biti generisan iz analize sa kategorijama i statistikom, NE mehanička lista
- Ako bilo koja git/gh komanda vrati grešku, prikaži grešku korisniku ali nastavi sa izvršavanjem ako je moguće (osim za kritične greške)

