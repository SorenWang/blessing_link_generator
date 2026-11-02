# 祝语工坊 · Blessing Link

一个可直接运行的祝福页配置与链接生成系统。每一条祝福由「主题 + 内容 + 组件 + 发布快照」组成，不需要为每单制作独立网页。

## 快速开始

要求 Node.js 22 或更高版本，项目没有第三方运行依赖。

```powershell
npm start
```

打开 `http://127.0.0.1:3000`，本地默认后台密码为：

```text
blessing-admin
```

正式使用前请复制 `.env.example` 为 `.env`，并修改后台密码：

```powershell
Copy-Item .env.example .env
```

```dotenv
PORT=3000
HOST=127.0.0.1
ADMIN_PASSWORD=请替换成你自己的强密码
PUBLIC_BASE_URL=http://127.0.0.1:3000
NODE_ENV=development
```

生产环境将 `NODE_ENV` 设为 `production` 后，如果没有设置 `ADMIN_PASSWORD`，应用会拒绝启动。

## 已实现功能

- 独立后台登录与 HttpOnly 会话 Cookie
- 祝福档案搜索、状态筛选、访问次数统计
- 新建、编辑、删除祝福页
- 草稿与发布状态分离
- 5 套完整主题：绢光信笺、星夜鎏金、青岚山色、绯页心事、午后琥珀
- 9 种祝福场合，自动生成标题、正文和结尾默认值
- 手机端真实预览
- 照片上传、时间线编辑、音频地址或音频上传
- 独立公开链接与后台预览链接
- CSV 粘贴导入、文件导入、名单预览、批量生成
- 批量发布、转草稿、删除
- 祝福链接有效期
- 公开页面禁止搜索引擎收录
- 公开页面 OG 标题和描述元信息
- 响应式后台与移动端祝福页
- 零第三方依赖，数据保存在本地

## 使用流程

1. 在「祝福库」新建一条祝福。
2. 填写收件人、发送人、场合和日期。
3. 选择主题，编辑正文、照片、时间线和声音。
4. 点击「保存并刷新」查看手机端真实预览。
5. 点击「保存并发布」生成正式链接。
6. 复制链接发送给客户或收件人。

收件人打开 `/b/<随机短码>` 后，会先看到封面和「轻启此信」印章。点击后才进入正文。

后台预览使用 `/b/<短码>?preview=1`，必须登录后台才能查看草稿内容。公开访问和预览访问不共用同一权限。

## 批量生成

在「批量生成」页面粘贴 CSV 或导入 `.csv` 文件。

标准表头：

```csv
recipient,sender,occasion,theme,title,message
林晚,阿宁,birthday,ivory,给林晚的生日来信,愿你新的一岁依然自由明亮
```

也支持中文表头：

```csv
姓名,署名,场合,主题,标题,祝福语
林晚,阿宁,生日,绢光信笺,给林晚的生日来信,愿你新的一岁依然自由明亮
```

支持的场合：

`birthday`、`anniversary`、`festival`、`graduation`、`wedding`、`newborn`、`gratitude`、`encouragement`、`custom`

支持的主题：

`ivory`、`night`、`celadon`、`rose`、`amber`

主题和场合既可以填英文键，也可以填中文名称。标题、发送人和正文可以留空，系统会按场合自动生成默认内容。

一次最多生成 200 条。示例文件位于 `examples/batch-sample.csv`。

## 素材替换

### 背景图

主题背景位于：

```text
public/assets/backgrounds/
```

已预置 5 张 SVG 背景：

```text
ivory-paper.svg
night-sky.svg
celadon-mist.svg
rose-paper.svg
amber-glow.svg
```

用同名新图片替换后刷新即可。若换成其它扩展名，需要同步修改 `public/blessing.css` 中对应主题的 `--theme-bg` 地址。

### 字体

将字体文件放在：

```text
public/assets/fonts/
```

预留的文件名：

```text
blessing-display.woff2
blessing-body.woff2
```

字体不存在时会自动回退到系统宋体、楷体和黑体。请只使用有网页授权的字体。

### 照片和音频

- 后台编辑器上传的文件：`data/uploads/`
- 公共图片素材：`public/assets/images/`
- 公共音频素材：`public/assets/audio/`

单个上传文件上限为 12MB。正式使用前建议将照片压缩到 2MB 以内。

## 本地数据

业务数据保存在：

```text
data/pages.json
```

上传素材保存在：

```text
data/uploads/
```

第一次启动时，若 `data/pages.json` 不存在，系统会自动创建两个演示祝福页。删除该文件并重启即可重新生成演示数据。

备份时同时复制 `data/pages.json` 和 `data/uploads/`。当前存储方案适合单机、小规模运营；如果后续需要多台服务器、多人权限或大量订单，建议把页面配置迁移到 PostgreSQL/MySQL，把上传文件迁移到对象存储。

## 目录结构

```text
.
├─ server.js                 Node.js HTTP 服务、API、登录、存储
├─ shared/
│  ├─ content.mjs            主题、场合、默认文案、数据规范化
│  └─ csv.mjs                CSV 解析
├─ public/
│  ├─ index.html             运营后台
│  ├─ admin.js / admin.css   后台交互与样式
│  ├─ blessing.html          公开祝福页模板
│  ├─ blessing.js / .css     祝福页渲染与主题样式
│  └─ assets/                背景、字体、图片、音频占位目录
├─ data/
│  ├─ pages.json             本地业务数据
│  └─ uploads/               客户上传素材
├─ examples/
│  └─ batch-sample.csv       批量导入示例
└─ test/                     自动化测试
```

## API 概览

公开接口：

- `GET /api/health`
- `GET /api/public/pages/:token`
- `GET /api/public/pages/:token?preview=1`，需要后台登录

后台接口：

- `POST /api/login`
- `POST /api/logout`
- `GET /api/auth`
- `GET /api/admin/overview`
- `POST /api/admin/pages`
- `PUT /api/admin/pages/:id`
- `DELETE /api/admin/pages/:id`
- `POST /api/admin/pages/:id/publish`
- `POST /api/admin/pages/:id/unpublish`
- `POST /api/admin/bulk`
- `POST /api/admin/batch`
- `POST /api/admin/uploads`

## 测试

```powershell
npm test
```

## 部署建议

1. 使用 HTTPS，并把 `PUBLIC_BASE_URL` 设置成正式域名。
2. 设置强 `ADMIN_PASSWORD` 和 `NODE_ENV=production`。
3. 使用反向代理转发到 Node 服务，并定期备份 `data/`。
4. 检查微信内打开、分享标题和链接预览。
5. 在中国大陆部署时，按实际情况处理域名备案、内容安全和隐私政策。
6. 背景音乐和客户上传素材需要确认版权与使用授权。

## 当前版本边界

- 单后台密码，暂无多用户和角色权限。
- 会话保存在内存中，服务重启后需要重新登录。
- 数据存储为本地 JSON，不适合多实例并发写入。
- 访问密码功能已预留在界面中，但尚未开放。
- 暂未加入二维码生成、支付、短信通知和自动清理过期素材。

这些都可以在现有数据结构上继续扩展。
