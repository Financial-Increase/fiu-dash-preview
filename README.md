# fiu-dash-preview

**Read-only mirror of the fiu-dash frontend, for Lovable preview.**

This repo is force-pushed by a GitHub Action in
[Financial-Increase/fiu-dash](https://github.com/Financial-Increase/fiu-dash)
on every push to `main`. **Do not commit here directly unless you accept that
your commit will be overwritten on the next sync.**

The Supabase client and auth layer have been replaced with fixture-backed
stubs. No real data flows through this repo.

Edits made via Lovable land on this repo's `main`. They are cherry-picked back
to `fiu-dash` per `docs/preview-sync.md` in the source repo, then re-emitted
on the next sync.
