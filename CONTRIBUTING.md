# Contributing

This repository holds the TypeScript SDK apps use to talk to Inazuma. Contributions are welcome, including your first one.

## Ways to help that are not code

- Follow a guide, and open an issue anywhere it was confusing or wrong.
- Report a bug with the exact commands you ran and what you saw.
- Improve the docs. Fixing one unclear paragraph is a real contribution.
- Answer someone else's question in the issue tracker.

## Setting up


        ```bash
        git clone https://github.com/inazuma-network/inazuma-sdk.git
        cd inazuma-sdk
        bun install            # or npm install
        bun run typecheck      # types must pass
        bun test               # if the package has tests
        ```


## Workflow

1. Open an issue first for anything non-trivial, so nobody duplicates your work.
2. Fork, then branch: `fix/rpc-timeout` or `feat/batch-submit`.
3. Make one logical change per pull request. Small reviews get merged fast.
4. Write commit messages as `area: what changed` — for example `mempool: cap per-account queue`.
5. Fill in the pull request template, including how you tested it.
6. A maintainer reviews. Expect questions; they are not criticism of you.


        ## Style

        - TypeScript, strict mode, no `any` unless you explain why in a comment.
        - No new runtime dependency without a reason in the pull request description.
          Small and auditable beats convenient.
        - Public functions get a short doc comment saying what it does and what it throws.


## Reporting security bugs

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

By contributing you agree your work is released under the MIT license in
[LICENSE](LICENSE).
