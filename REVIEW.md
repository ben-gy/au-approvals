# Building Approvals — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-approvals/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://au-approvals.benrichardson.dev

## What it is

Every new home Australia approves to build, mapped to the SA3 region it will go in and measured against the National Housing Accord. New residential dwelling approvals (ABS, monthly from Jul 2021, ~337 SA3 regions), split houses vs townhouses vs apartments, joined to resident population and real ABS boundaries.

## DNS setup (already applied)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-approvals` | `ben-gy.github.io` | DNS only (grey cloud) |

If the cert needs re-triggering:
```bash
gh api repos/ben-gy/au-approvals/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/au-approvals/pages -X PUT -f cname="au-approvals.benrichardson.dev"
```
