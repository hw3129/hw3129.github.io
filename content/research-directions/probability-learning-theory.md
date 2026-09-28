We study a fundamental process arising in the framework of multi-group PAC learning. Let \((\mathcal{X},P)\) be a probability space, let \(\mathcal{H}\subset\{-1,1\}^\mathcal{X}\) be a hypothesis class, let \(\mathcal{G}\subset\{0,1\}^\mathcal{X}\) be a VC class, and let \(P_n\) denote the empirical distribution. Writing \(\hat{\mathcal{R}}_n(g\mathcal{H})\) for the empirical Rademacher complexity of the function class \(g\mathcal{H}\), we study the following offset process and its uniform convergence rate:

\[
Z_g(c):=\sup_{h\in\mathcal{H}}(P-P_n)gh-c\,\hat{\mathcal{R}}_n(g\mathcal{H}),\quad\text{and}\quad r_n(c):=\sup_{(\mathcal{G},\mathcal{H})}\mathbb{E}\sup_{g\in\mathcal{G}} Z_g(c).
\]

In our work on gated product function classes {cite:gated-product-complexity}, we characterize the boundary behavior of this offset process:

\[
r_n(c)\asymp
\begin{cases}
\sqrt{(\log n)/n}, & c=2,\\
(\log n)/n, & c\asymp\sqrt{\log n},
\end{cases}
\quad\text{with}\quad
\begin{cases}
r_n(c)\gtrsim(\log n)/n, & c\ge 2,\\
r_n(c)\text{ does not converge to }0, & c<2.
\end{cases}
\]

In separate work, we extend Glivenko–Cantelli theory to \(f\)-divergences {cite:f-divergence}.
