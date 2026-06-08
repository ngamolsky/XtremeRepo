# Bogey source-data notes

Bogey calculations treat the parsed race spreadsheet/PDF source rows as the official/canonical basis when those source rows provide per-leg split values. The app's curated `v_results_with_pace` official results are still used to attach the Xtreme runner/leg identity, but historical source split rows drive the pass/pass-by math.

Known source mismatches / limitations:

- 2022 Xtreme Falcons: the official spreadsheet row has total time `11:29:44.4` and split values for laps 1-5, with laps 6-7 blank/dash. The curated app result total for 2022 differs by about 35 seconds and has seven leg rows. For bogey calculations, use the spreadsheet's available split values as canonical for legs with source splits, and compute no source-based bogeys for missing later laps.
- Several older years have historical team rows but no trustworthy all-team per-leg split extraction in the current data. Those years intentionally produce zero bogey events until source split data is added.
- Some extracted result files contain duplicate ranking-section rows for the same bib/team/total. `v_bogey_events` de-duplicates representative team rows before computing crossings so duplicates do not double-count bogeys.
- Years with missing start offsets are labeled `same_start_assumed`; these are rank-crossing estimates and may not equal physical on-course passes if wave starts differed.
