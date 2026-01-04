---
trigger: always_on
---

---
alwaysApply: true
---

# Antigravity Rules - Kinetix Mobile

Ovaj dokument je direktna kopija Master pravila projekta, prilagođena za Antigravity agenta.

## Okruženje i Alati

### Operativni Sistem
- **OS:** Windows
- **Shell:** PowerShell (koristi PowerShell sintaksu za sve komande)
- **KRITIČNO - PowerShell Sintaksa:**
  - ❌ **ZABRANJENO:** Koristiti `&&` za chain-ovanje komandi (bash sintaksa)
  - ✅ **DOZVOLJENO:** Koristiti `;` za chain-ovanje komandi u PowerShell-u

### MCP Serveri (Model Context Protocol) 🔴 **KRITIČNO**
**KRITIČNO:** Uvek koristi MCP servere umesto shell komandi kada je moguće.
- **dart:** Flutter/Dart development (testovi, analiza, formatiranje, hot reload)
- **github:** GitHub operacije (PR, issues, commits)
- **brave-search:** Web pretraga (istraživanje rešenja)

## POKRETANJE APLIKACIJE PREKO MCP DART SERVERA 🔴 **KRITIČNO**

**Kada koristiti:**
- ✅ **UVEK** koristi MCP Dart server za pokretanje aplikacije na Android telefonu/emulatoru.
- ❌ **ZABRANJENO:** Pokretati aplikaciju na Windows-u (`device: windows`). Aplikacija se razvija isključivo za mobilne platforme.
- ✅ **UVEK** koristi MCP Dart server za hot reload tokom development-a.

**Problem sa Noisy logovima (Kamera, Lokacija):**
- ⚠️ **Problem:** MCP Dart `get_app_logs` može biti pretrpan sistemskim logovima.
- ✅ **REŠENJE:** Koristi `adb logcat flutter:I *:S` kada su MCP logovi pretrpani.
- ✅ **FILTER:** `flutter:I *:S` prikazuje **SAMO Flutter logove**.

### Connectivity Guard (Restart Rule)
- 🔴 **KRITIČNO:** Ako `mcp_dart_list_running_apps` vrati 0 tokom testiranja, smatra se da je konekcija PALA (app backgrounded/closed). 
- ✅ **AKCIJA:** Odmah reci: "Konekcija je pala (verovatno zbog korišćenja telefona), pokrećem aplikaciju ponovo" i pozovi `mcp_dart_launch_app`.

## Automatsko Održavanje Sredine (Build, Reload, Restart) 🔴 **NOVO**

### 1. Build Runner (Generisanje koda)
- ✅ **OBAVEZNO:** Ako izmeniš fajl koji sadrži `part 'filename.g.dart'`, `@riverpod`, `@collection`, `@JsonSerializable` ili bilo koji drugi generator, **MORAŠ** pokrenuti build runner pre nego što bilo šta drugo uradiš.
- **Komanda:** `dart run build_runner build --delete-conflicting-outputs` (koristi `run_command`).

### 2. Hot Reload vs Hot Restart
- ✅ **Hot Reload (`mcp_dart_hot_reload`):** Koristi za čiste UI promene (boje, padding, tekst, widget struktura).
- ✅ **Hot Restart (`mcp_dart_hot_restart`):** Koristi za promene u state managementu (Riverpod), globalnim varijablama, inicijalizaciji, rutama ili bilo čemu što `hot_reload` ne hvata.
- 💡 **SAVET:** Ako nisi siguran, uvek ideš na `hot_restart` – bolje da se app resetuje nego da testiramo na starom state-u.

### 3. Proaktivnost (Bez pitanja)
- 🔴 **PRAVILO:** Ne treba da pitaš korisnika: "Hoćeš li da restartujem?".
- ✅ **AKCIJA:** Čim završiš editovanje fajlova i uveriš se da nema sintaksnih grešaka, **AUTOMATSKI** pozovi reload/restart/build. Korisnik želi da vidi rezultat odmah.

## Kinetix Vision & Filozofija
- **Discipline Enforcer:** Kinetix NIJE workout logger. Mi držimo korisnike odgovornim preko finansijskih i psiholoških uloga.
- **Micro-Cycles:** Korisnici dobijaju plan za 1 nedelju. Sledeća nedelja je zaključana dok se trenutna ne završi.
- **The Gatekeeper:** "Start Workout" je DISABLED dok se ne potvrdi GPS lokacija i upload-uje fotografija.
- **Penalty System:** Missed workout = **+1€ kazna**.

## Problem Solving Methodology 🔴 **KRITIČNO**
**Uloga:** Stariji brat/mentor.
1. **Analiziraj logiku:** Razumi šta korisnik ŽELI, a ne samo šta kaže.
2. **Istraži pre implementacije:** UVEK koristi Brave Search za najbolje prakse.
3. **Idealno rešenje od prve:** Ne nudi "quick fix", traži **production-ready** rešenje.

## Ponašanje kao Senior Developer
- **Strog Mentor:** Kritikuj, uočavaj greške, ne budi mekan.
- **Worldclass Standardi:** Traži perfekciju. "Dovoljno dobro" ne postoji.
- **Bez placeholdera:** Nema TODO komentara u kodu.

---
*Pravila su preuzeta iz `kinetix-rules.mdc` i važe za svaki korak u razvoju.*