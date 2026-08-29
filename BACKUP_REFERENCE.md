# Sicherung der Altprojekte

Vor dem Neubau wurden alle bestehenden Projekte gesichert. **Kein
Quellprojekt wurde verändert**, verschoben, gestaged, zurückgesetzt oder
bereinigt. Es wurde nichts zu einem Remote gepusht.

## Wo

`~/_project_backups/2026-08-29_1848/` — das Verzeichnis ist mit
`chmod 700` geschützt.

Das vollständige Manifest mit Pfaden, Commits, Prüfsummen und
Wiederherstellungsbefehlen liegt dort als `BACKUP_MANIFEST.md`.

## Was gesichert wurde

Acht Projekte, jeweils mehrfach abgesichert:

| Bestandteil | Inhalt |
|---|---|
| `inventory/` | Branch, Commit, `git status --porcelain=v1 -uall`, Paketmanager-Dateien, Migrationsverzeichnisse, **Namen** vorhandener `.env`-Dateien |
| `bundles/` | `git bundle --all` — vollständige Historie, alle Refs und Tags |
| `patches/` | `git diff --binary HEAD` — Änderungen an versionierten Dateien |
| `archives/` | Arbeitsbaum als `tar.gz`, **inklusive** unversionierter Dateien |
| `CHECKSUMS.sha256` | Prüfsummen über alle 15 Sicherungsdateien |

| Projekt | Git | Offene Änderungen |
|---|---|---|
| EUPoC-HAPOC | nein | – |
| EUPoC-HAPOC-Analyzer | ja | **49** |
| enseling-consulting-cinematic | ja | 0 |
| enseling-consulting-website | ja | 0 |
| enseling-editorial | ja | 0 |
| enseling-immersive-villa | ja | 0 |
| eupoc website | nein | – |
| eupoc-website-redesign | ja | 0 |

## Verifikation

Am Sicherungszeitpunkt ausgeführt:

- `gzip -t` und `tar -tzf` über alle 8 Archive: **8 lesbar, 0 defekt**
- `git bundle verify` über alle 6 Bundles: **6 bestätigt**
- `shasum -a 256` über alle 15 Dateien

Erneut prüfen:

```bash
cd ~/_project_backups/2026-08-29_1848
shasum -a 256 -c CHECKSUMS.sha256
```

## Wiederherstellen

Vollständiger Arbeitsstand, auch das nicht Eingecheckte:

```bash
mkdir -p ~/restore
tar -xzf ~/_project_backups/2026-08-29_1848/archives/PROJEKT.worktree.tar.gz -C ~/restore
cd ~/restore/PROJEKT && npm install
```

Nur die Historie:

```bash
git clone ~/_project_backups/2026-08-29_1848/bundles/PROJEKT.bundle PROJEKT
```

Beim **Analyzer** ist das Archiv der vollständigere Stand: der Patch
deckt nur versionierte Dateien ab, neue Dateien stehen ausschließlich im
Archiv.

## Zu Secrets

Dieses Dokument enthält **keine** Secret-Werte und keine Dateiinhalte.
`.env`-Dateien sind im Inventar nur mit **Namen** erfasst. Ihre Inhalte
liegen ausschließlich in den lokalen Archiven im geschützten
Sicherungsverzeichnis — und gehören niemals in dieses Repository.

## Zu ungespeicherten Editor-Dateien

Auf ungespeicherte Puffer im Editor besteht kein Zugriff. Die Sicherung
erfasst den Stand auf der Festplatte zum genannten Zeitpunkt. Wurden
danach Dateien im Editor gespeichert, ist der Archivschritt zu
wiederholen — das Skript dafür liegt als `backup.sh` im
Sicherungsverzeichnis.
