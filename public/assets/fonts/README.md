# 字体素材

当前页面会优先使用系统中文字体，并把以下文件名作为可替换入口：

- `blessing-display.woff2`：大标题、姓名、章节标题字体
- `blessing-body.woff2`：正文与后台界面字体

将字体文件放入本目录后，在 `public/admin.css` 和 `public/blessing.css` 的 `@font-face` 中已经预留了同名引用。若字体文件不存在，会自动回退到系统宋体、楷体或黑体，不影响使用。

替换字体前请确认拥有网页使用授权。
