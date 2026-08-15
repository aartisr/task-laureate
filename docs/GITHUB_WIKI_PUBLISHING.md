# Publishing the GitHub Wiki

The editable, reviewable source for the project Wiki is stored in
[`wiki/`](../wiki). GitHub Wikis are a separate Git repository, so publishing
requires a maintainer with GitHub write access.

## Publish the source

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
