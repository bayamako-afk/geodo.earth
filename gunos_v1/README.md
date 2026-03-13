# GUNOS V1

**GUNOS V1** is the first playable multi-city platform release of the GUNOS engine.

> GUNOS = the multi-city platform  
> GUNO = each city game built on top of GUNOS  
> GUNOS V1 = the first playable multi-city platform version

---

## Cities

| City | ID | Status |
|------|----|--------|
| GUNO Tokyo | `tokyo` | ✅ data_ready |
| GUNO Osaka | `osaka` | ✅ data_ready |
| GUNO London | `london` | ✅ data_ready |
| GUNO NYC | `nyc` | ✅ data_ready |

---

## Running locally

Serve from the repository root (not from inside `gunos_v1/`):

```bash
cd geodo.earth/
python3 -m http.server 8080
```

Then open:

```
http://localhost:8080/gunos_v1/
http://localhost:8080/gunos_v1/?city=tokyo
http://localhost:8080/gunos_v1/?city=osaka
http://localhost:8080/gunos_v1/?city=london
http://localhost:8080/gunos_v1/?city=nyc
```

> **Important:** The server must be started from the repository root (`geodo.earth/`), not from inside `gunos_v1/`, because city data packages are loaded from `../guno_v6/cities/` relative paths.

---

## Structure

```
gunos_v1/
├─ index.html              # Main shell
├─ src/
│  ├─ app/main.js          # Entry point
│  ├─ city/city_loader.js  # City loader
│  ├─ city/city_ui.js      # City UI helpers
│  ├─ state/app_state.js   # App state
│  ├─ core/                # (Phase 3+)
│  ├─ ui/                  # (Phase 2+)
│  ├─ game/                # (Phase 3+)
├─ config/city_registry.json
├─ assets/
└─ docs/
   └─ phase1_scaffold.md
```

---

## Development phases

| Phase | Goal | Status |
|-------|------|--------|
| Phase 1 | New app scaffold | ✅ Complete |
| Phase 2 | Main play layout | — |
| Phase 3 | Play engine integration | — |
| Phase 4 | Map-first gameplay | — |
| Phase 5 | Scoring / result UX | — |
| Phase 6 | Multi-city runtime polish | — |
| Phase 7 | Final V1 presentation layer | — |

---

## Reference

- Versioning policy: `guno_v6/docs/versioning_policy.md`
- 4-city comparison: `guno_v6/docs/four_city_comparison_report_ja.md`
- Online smoke test: `guno_v6/docs/online_smoke_test_report.md`
- City package spec: `guno_v6/docs/city_package_spec.md`
