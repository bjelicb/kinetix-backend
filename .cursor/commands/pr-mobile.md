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

6. **Kreiraj commit:**
   - **Naslov commit-a:** `misija` (tačno ovaj string, bez dodatnih karaktera)
   - **Body commit-a:** 
     - Prvi red: "Automatski commit sa lokalnim izmenama."
     - Prazan red
     - "Detalji izmena:"
     - Lista svih izmena iz `git status --porcelain` output-a, svaka izmena u novom redu sa 2 space-a indentacije
   - Format komande: `git commit -m "misija" -m "Automatski commit sa lokalnim izmenama.\n\nDetalji izmena:\n  [izmena1]\n  [izmena2]\n  ..."`
   - Primer body-a:
     ```
     Automatski commit sa lokalnim izmenama.

     Detalji izmena:
       M  lib/screens/home_screen.dart
       A  lib/models/new_model.dart
       D  lib/utils/old_util.dart
     ```

7. **Push na bunar:**
   - Pokreni: `git push -u origin bunar`
   - Ako push ne uspe, prikaži grešku i završi

8. **Kreiraj GitHub PR:**
   - Proveri da li PR već postoji: `gh pr list --head bunar --base master --json number`
   - Parsiraj JSON output i proveri da li postoji PR
   - Ako PR postoji, obavesti korisnika: "PR već postoji (broj: [number])" i završi komandu
   - Ako PR ne postoji:
     - **Title:** `misija` (tačno ovaj string)
     - **Body:** 
       - "Automatski kreiran PR sa izmenama sa branch-a bunar."
       - Prazan red
       - "## Izmene"
       - Lista svih izmena iz `git status --porcelain` output-a, svaka izmena u novom redu sa 2 space-a indentacije
       - Prazan red
       - "## Opis"
       - "Ovaj PR sadrži sve lokalne izmene koje su bile na branch-u bunar."
     - Komanda: `gh pr create --base master --head bunar --title "misija" --body "[body tekst]"`
     - Primer body-a:
       ```
       Automatski kreiran PR sa izmenama sa branch-a bunar.

       ## Izmene
         M  lib/screens/home_screen.dart
         A  lib/models/new_model.dart
         D  lib/utils/old_util.dart

       ## Opis
       Ovaj PR sadrži sve lokalne izmene koje su bile na branch-u bunar.
       ```

## Važne napomene

- **SVE se izvršava automatski bez pitanja korisnika** - agent ne sme da pita korisnika ništa tokom izvršavanja
- Koristi lokalni git i gh CLI koji su već instalirani i ulogovani
- Ako nema izmena, komanda se završava bez greške (exit 0)
- Ako PR već postoji, komanda se završava bez kreiranja novog
- Za commit body i PR body, koristi PowerShell here-string sintaksu (`@"..."@`) ili escape karaktere (`\n` za novi red)
- Formatiranje liste izmena: svaka linija iz `git status --porcelain` output-a treba da bude u novom redu sa 2 space-a indentacije
- Ako bilo koja git/gh komanda vrati grešku, prikaži grešku korisniku ali nastavi sa izvršavanjem ako je moguće (osim za kritične greške)

