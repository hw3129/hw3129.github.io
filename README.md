# Academic Website

Minimal Hugo academic website using a custom layout with configurable typography.

## 日常更新与发布

网站已发布在 <https://hw3129.github.io/>。修改完成后，在本项目目录运行：

```bash
./scripts/publish.sh "更新论文与简介"
```

也可以直接运行 `./scripts/publish.sh`，默认提交说明为 `Update website`。
在 Codex 中直接说“提交并发布网站”即可使用同一流程。

脚本会检查远程版本，以 Hugo **0.92.2 extended** 构建本次暂存的源码，
以 **hw3129** 创建提交、推送到 `main`，并等待对应的 GitHub Pages 任务成功。
出现“发布成功”后即可访问网站；不必再去 GitHub 手动操作。

- 构建失败：不会创建提交或推送。修改仍在本地，修复后重跑。
- 推送失败：提交仍在本地，恢复网络后重跑，不会创建重复的空提交。
- 远程出现新提交：停止并保留双方修改；先检查合并，再重跑，不会强制覆盖。
- 代码已推送但部署失败：查看输出的 Actions 链接，修复后再次提交发布。
- 没有新修改或待推送提交：直接提示，无需重复提交。

自动提交范围包括网站内容、图片、模板、样式、脚本、测试、发布配置以及
`README.md`、`AGENTS.md`、`.gitignore`、`config.toml`。
范围之外的改动会提示人工检查；构建产物、备份、`.tools/`、本地编辑器设置
和 `.env` 文件会被忽略。该命令包含范围内的全部修改，包括删除文件。

当前电脑已配置提交身份和 GitHub 登录。本地 GitHub CLI 的备用位置是
`.tools/gh`，不依赖临时目录，也不会上传仓库。换电脑后需要安装上述 Hugo
版本、安装 GitHub CLI，并用 `gh auth login` 登录 `hw3129`。脚本只设置本仓库
的提交身份，不修改其他项目的 Git 配置。查看用法：`./scripts/publish.sh --help`。

## Edit Content

Profile text and the profile image path live in `data/profile.toml`.
Images can be `.png`, `.jpg`, or `.jpeg` files placed under `static/images/`.
The `research_direction` entries control each subject's stable ID, title, order,
and expandable Markdown overview in the Subject paper view:

```toml
[[research_direction]]
id = "tensor-methods"
title = "Tensor Methods and Structured Learning"
text_file = "content/research-directions/tensor-methods.md"
```

Omit both `text` and `text_file` when a subject has no overview. It will render
as a static subject heading without an arrow or expandable control.

Edit the story bodies in `content/research-directions/*.md`. Use
`{cite:paper-id}` in those Markdown files to cite a paper by its stable `id`.
These files are raw Markdown fragments, so do not add front matter to them.
Set `math_engine = "mathjax"` to render LaTeX inside the direction Markdown files,
or set it to `"off"` to disable math rendering. Use `\(...\)` for inline math
and `\[...\]` for display math. Dollar delimiters are intentionally unsupported,
so ordinary currency text cannot be mistaken for a formula. Markdown uses normal,
single backslashes:

```md
The risk is \(R(f) = \mathbb{E}[\ell(f(X),Y)]\).
```

Math markup is protected before Hugo processes the surrounding Markdown.
MathJax 4.1.3 is loaded from jsDelivr only when a research formula is present,
and each formula is typeset when its Subject overview is first expanded. Long
display formulas scroll horizontally when the available width is too narrow.
Set `paper_tools = "on"` to show `Google Scholar | Subject` under Papers. Papers
are chronological by default; the button changes to `Chronological` in Subject
view and switches back when clicked. Set `paper_tools = "off"` to hide the row
and keep only the chronological view.
Set `paper_summaries = "on"` to give each paper that has a `summary` a `more`
toggle that expands the summary and its figure. Set it to `"off"` to hide the
toggles, summaries, and figures and restore the plain paper list; the paper
data can stay in place.
Set `default_theme = "dark"` or `default_theme = "light"` to choose the theme for
first-time visitors. A visitor's saved theme choice takes precedence afterward.
Set `font_family` to `"verdana"`, `"system"`, `"helvetica"`, `"georgia"`,
`"charter"`, `"inter"`, `"source-sans-3"`, `"source-serif-4"`, or
`"work-sans"`. Inter, Source Sans 3, Source Serif 4, and Work Sans are loaded
from Google Fonts only when selected; the other options use local fonts.
Set `section_order` in `data/profile.toml` to arrange homepage sections after About:

```toml
section_order = ["experience", "papers", "teaching"]
```

Use `papers` for the publications section and the lowercase heading IDs from `content/_index.md`
for Markdown sections.

Extra homepage sections live in `content/_index.md`. Add sections with Markdown headings:

```md
## Teaching

STAT XXXX, Columbia University, Spring 2026.

## Talks

- Talk title, venue, 2026.
```

Add the lowercase heading ID to `section_order` to show it in the page and floating table of contents.

Papers live in `data/papers.toml`. Supported fields include:

```toml
[[paper]]
id = "paper-title"
visible = true
subject = "tensor-methods"
title = "Paper Title"
authors = "Haoming Wang and Coauthor"
journal = "Journal Name"
venue = "Manuscript"
year = 2026
research_year = 2025
volume = "12"
number = "3"
pages = "100-120"
url = "https://example.com/paper.pdf"
```

`visible` defaults to `true` when omitted. Set `visible = false` to exclude a
paper from both chronological and Subject views. Hidden papers are omitted from
the generated paper entries; numbering and year markers follow the visible
papers, and subjects with no visible papers are omitted. Citations to hidden
papers are removed from research overviews, while the surrounding prose remains.
Use TOML booleans (`true` / `false`), not quoted strings.

`year` is the publication or bibliographic year. `research_year` is the year in
which the core research work for the project was primarily carried out, and it
controls chronological ordering. In chronological view, each research year
appears once at the right edge, aligned with the first paper title for that year.
These muted year markers have a "Research year" tooltip and are hidden in Subject
view; publication years remain in the paper metadata.
Papers should stay in newest-to-oldest `research_year` order in
`data/papers.toml`.

`subject` must match exactly one `research_direction.id`. Subject view moves the
same paper entries under those direction headings while preserving their
chronological order within each group. Each paper has one primary subject.

If `url` is present, the paper title opens that link. The title keeps the same color by default and changes to the theme link color on hover.
Paper numbers are generated once from visible papers' chronological order in `papers.toml`
and remain unchanged in Subject view, so gaps inside a subject are expected.
Add a new visible `[[paper]]` block at the top and it becomes `[1]`; all following
numbers and research-story citations update automatically. The optional `id`
stays stable when papers are reordered and defaults to a slug made from `title`.
Use lowercase letters, numbers, and single hyphens for explicit IDs.

Expandable summaries use these optional fields:

```toml
summary = '''
Two or three sentences on what the paper does. Markdown is allowed.
'''
figure = "images/papers/paper-title.svg"
figure_alt = "What the figure shows"
figure_position = "50% 30%"
figure_invert = false
```

Only papers with a `summary` get a `more` toggle, and only one summary is open
at a time. The summary uses the same size as the paper text and is set apart by
color. With `math_engine = "mathjax"`, summaries accept `\(...\)` and `\[...\]`
math like the research directions; MathJax loads only when a visible summary
contains math, and formulas are typeset when their summary is first opened. `figure` is optional and lives under `static/images/papers/`. It fills
the right part of the entry, fades into the end of the summary lines, is shown
in grayscale, and is inverted in dark mode, so figures with white or transparent
backgrounds work best. Crop figures to about 2.5:1 and keep the important part
in the right half; the left part fades under the text. `figure_position` sets
which part stays visible when the figure is cropped to fit, and
`figure_invert = false` keeps photos and dark images from being inverted.
Figures are hidden on screens narrower than 960px.

## Local Preview

Run:

```bash
hugo server -D --bind 127.0.0.1 --port 1313 --baseURL http://127.0.0.1:1313/
```

Then open:

```text
http://127.0.0.1:1313/
```

The `--bind 127.0.0.1` option keeps the preview local to this machine.

## Publish to GitHub Pages

The production address is `https://hw3129.github.io/`.
`.github/workflows/pages.yml` builds with Hugo **0.92.2**, the locally verified
version, and publishes the generated `public/` directory. Keep this version
pinned until a Hugo upgrade has been tested against the templates.

The repository is connected and **Settings → Pages → Build and deployment →
Source** is already set to **GitHub Actions**. Use the command above for normal
updates. Pushes to the default `main` branch deploy automatically; the workflow
also supports `master` if it becomes the default. Other branches do not publish.

The source repository is public, including committed paper entries with
`visible = false`; that setting only hides them from the rendered website.
Deployment details: [Hugo deployment guide](https://gohugo.io/host-and-deploy/deploy-to-github-pages/).

## Visit Analytics

Cronitor RUM is configured in `config.toml` under `[params.cronitor]`.
The `client_key` is the public browser tracking key, not an account management
API key. The tracker loads only in production builds, outside `hugo server`,
and when the browser visits `https://hw3129.github.io`. Local previews and
copies served on other hostnames do not load or send data to Cronitor.
Clear `client_key` to disable tracking. Update `hostname` if the public domain
changes.

Build for the planned GitHub Pages address with:

```bash
hugo --environment production --baseURL https://hw3129.github.io/
```

This builds the site locally; it does not publish it. Cronitor data starts
arriving after deployment and real visits to the production hostname.
Its dashboard provides pageviews, sessions, traffic sources, approximate
locations, and device/browser information. Select hourly or daily time ranges
and use `America/New_York` for the reporting timezone.

Two custom events identify papers by their stable `id` in `data/papers.toml`:

| Event | Recorded when |
| --- | --- |
| `paper_click.<paper-id>` | A paper title link is activated by a normal click, keyboard Enter, or middle click. |
| `summary_open.<paper-id>` | A paper summary changes from closed to open. Closing it does not count. |

For example, `paper_click.exact-decision` and `summary_open.exact-decision`
both refer to **Structure and Exact Certification of Nonnegative Tensor
Decompositions**. Switching paper views does not create an event. Opening a
summary again counts as another open. Link clicks measure clicks, not confirmed
PDF downloads or reading on the destination site.

Keep explicit paper IDs stable when reordering or renaming papers. With Cronitor
enabled, visible paper IDs may contain at most 51 characters so both event names
fit Cronitor's 64-character limit; a longer ID fails the build with guidance.

After publishing, visit the homepage in a normal browser, open a paper link,
and expand its summary. Confirm the pageview and both named events in Cronitor.
To exclude subsequent visits from your own browser, visit
`https://hw3129.github.io/?cronitor_rum_disable`; use `?cronitor_rum_enable`
to include that browser again. These flags are stored by Cronitor in that
browser. Ad blockers can prevent analytics from being collected.
