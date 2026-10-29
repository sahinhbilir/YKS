# YÖK Atlas catalogue

`data/yokatlas.json` is a static public catalogue built from the official [YÖK Atlas](https://yokatlas.yok.gov.tr/) `tercih-kilavuz/search` and `netler/search` API snapshots. It uses the 2026 programme catalogue and 2025 historical placement data; the output records both years and the retrieval timestamp. Historical nets describe the last placed candidate, not an admission probability or guarantee. Missing or inconsistent historical values are left unavailable.

The picker includes bachelor's programmes in SAY, EA and SÖZ physically located in İstanbul, Ankara, Eskişehir, Kocaeli or İzmir, at state universities or foundation universities with a full tuition scholarship (`bursOraniId=158`, Burslu). It excludes KKTC nationality-restricted quotas and identified foreign campuses. The physical programme city is used rather than the university headquarters.

Rebuild from a populated local cache without refreshing source responses:

```sh
python scripts/build-yokatlas.py --cache-dir ../yok-inspect/cache --output data/yokatlas.json
```

To update from the official source, use a cache directory and add `--refresh`. The builder fetches public programme data only. It does not read student records, credentials or a cloud notebook; the catalogue is a static website asset outside the notebook.
