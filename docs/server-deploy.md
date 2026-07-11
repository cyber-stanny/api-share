# 独立服务器快速部署

第一阶段推荐方案：完整 Express 应用部署在一台云服务器上，数据库继续使用现有 CloudBase 环境。

## 服务器准备

安装 Node.js 18 或 20、Git、PM2、Nginx。

```bash
npm install -g pm2
```

## 拉取代码

```bash
git clone <your-repo-url> api-share
cd api-share
npm ci
cp .env.example .env
```

编辑 `.env`，至少配置：

```bash
CLOUDBASE_ENV_ID=你的 CloudBase 环境 ID
TENCENT_SECRET_ID=腾讯云 SecretId
TENCENT_SECRET_KEY=腾讯云 SecretKey
TENCENTCLOUD_REGION=ap-shanghai
JWT_SECRET=和 CloudBase 部署保持一致的随机密钥
ADMIN_INIT_PASSWORD=管理员初始密码
CORS_ORIGINS=https://你的域名
PROXY_ENABLED=true
DEEPSEEK_API_KEY=你的 DeepSeek Key
```

`TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 需要有访问对应 CloudBase 环境数据库的权限。`TENCENTCLOUD_REGION` 需要设置为 CloudBase 环境所在地域，例如上海环境使用 `ap-shanghai`。

## 初始化数据

如果 CloudBase 数据库里已经初始化过管理员、上游和白名单，可以跳过。

```bash
node scripts/init-admin.js
node scripts/seed-upstreams.js
```

如果你已经把上游 Key 放进环境变量，并且数据库里已有对应上游记录，可以再执行：

```bash
npm run sync:upstreams
```

供应商迁移发布时，先预览再应用上游对账。预览不会修改数据库；应用会禁用 MiniMax、旧 DeepSeek Token Plan、MiMo 与 Aliyun 上游，只保留 DeepSeek Official API：

```bash
npm run reconcile:upstreams
npm run reconcile:upstreams:apply
```

## 启动服务

```bash
npm run pm2:start
pm2 save
```

检查：

```bash
curl http://127.0.0.1:3000/health
```

## Nginx 反向代理

示例配置：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

配置 HTTPS 后，把学生端和管理端都指向同一个域名：

- 学生首页：`https://your-domain.example.com/`
- 管理后台：`https://your-domain.example.com/admin`
- OpenAI Base URL：`https://your-domain.example.com/v1`
- Anthropic Base URL：`https://your-domain.example.com`

## CloudBase 原部署

服务器部署验证通过后，CloudBase 免费版函数建议设置：

```bash
PROXY_ENABLED=false
```

这样 CloudBase 仍可作为备用 Web 入口，但不会再承载 `/v1/*` API 转发。

## 更新发布

```bash
git pull
npm ci
npm run pm2:reload
```

查看日志：

```bash
pm2 logs api-share
```
