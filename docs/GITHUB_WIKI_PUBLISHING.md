# Publishing the GitHub Wiki

The editable, reviewable source for the project Wiki is stored in
[`wiki/`](../wiki). GitHub Wikis are a separate Git repository. The committed
`Publish GitHub Wiki` workflow synchronizes the source automatically whenever
`wiki/` changes on `master`.

## Automatic publishing

After the Wiki feature is enabled, push the repository change that adds or
updates `wiki/`. The GitHub Actions workflow clones the Wiki repository, copies
the maintained Markdown pages, and commits them. Its first successful run makes
the Wiki visible at `https://github.com/aartisr/task-laureate/wiki`.

If a run fails because the repository token cannot write to the Wiki, use the
one-time manual fallback below and check that the workflow has `contents: write`
permission in the Actions settings.

## Manual fallback

```sh
git clone https://github.com/aartisr/task-laureate.wiki.git
cd task-laureate.wiki
cp -R ../task-laureate/wiki/. .
git add .
git commit -m "docs: publish Task-Laureate wiki"
git push
```

Use GitHub’s web editor for small corrections, then mirror improvements back to
`wiki/` in this repository in the same pull request. The repository copy is the
reviewable source of truth.

## Link architecture

Every Wiki page links to the live app, GitHub Pages documentation hub, or
repository documentation index. The Pages hub points back to the Wiki. Do not
manufacture or buy external backlinks; build useful, truthful pages that people
can naturally reference.
