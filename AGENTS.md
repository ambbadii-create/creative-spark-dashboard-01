<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Purchase orders live only in the stock store (src/lib/stock); the Achats module (src/lib/purchase) references them and must receive goods through PurchaseProvider.receive so stock and receipt history stay in sync.
- Treasury uses the existing demo providers and linked sales/purchase payments, never copied invoice workflows; provider composition keeps source ownership intact.
- Treasury accounting transmission creates idempotent draft entries in the accounting store for review, not a second treasury journal.
- Treasury role selection is a demo simulation only, not authentication or production authorization; real deployment requires server-validated roles.
