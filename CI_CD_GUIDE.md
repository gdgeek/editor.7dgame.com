# CI/CD 配置指南

本文档描述如何为项目配置 GitHub Actions CI/CD，自动构建 Docker 镜像并推送到腾讯云香港容器镜像仓库。

## 1. 前置条件

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

| Secret 名称 | 说明 |
|---|---|
| `TENCENT_REGISTRY_USERNAME` | 腾讯云容器镜像服务用户名 |
| `TENCENT_REGISTRY_PASSWORD` | 腾讯云容器镜像服务密码 |

## 2. 分支与 Docker Tag 策略

| 分支 | 触发 CI | Docker Tag |
|---|---|---|
| `develop` | ✅ | `develop` |
| `main` / `master` | ✅ | `main` |
| `publish` | ✅ | `publish` + `latest` |

- PR 到 `main`/`master` 也会触发 CI（仅测试，不构建镜像）
- 支持 `workflow_dispatch` 手动触发

## 3. 镜像仓库

- 地址：`hkccr.ccs.tencentyun.com`
- 镜像名：`hkccr.ccs.tencentyun.com/<命名空间>/<镜像名>`
- 例如：`hkccr.ccs.tencentyun.com/gdgeek/editor`

> 在 `build.yml` 中修改 `TENCENT_IMAGE_NAME` 环境变量来适配你的项目。

## 4. CI 流程

```
push → test → build → push to 腾讯云
```

测试通过后才会构建 Docker 镜像。

## 5. 文件结构

```
.github/workflows/
├── ci.yml      # 主流程：触发分支、串联 test 和 build
├── test.yml    # 测试：ESLint + 单元测试 + 覆盖率
└── build.yml   # 构建：Docker 镜像构建并推送到腾讯云
Dockerfile       # 基于 nginx:alpine，支持 BUILD_TIME 注入
.dockerignore    # 排除不需要打包的文件
```

## 6. 配置文件

### 6.1 ci.yml

```yaml
name: CI Pipeline

on:
  push:
    branches: [ main, master, develop, publish ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  test:
    name: Test
    uses: ./.github/workflows/test.yml

  build:
    name: Build
    needs: test
    uses: ./.github/workflows/build.yml
    permissions:
      contents: read
      packages: write
    secrets:
      TENCENT_REGISTRY_USERNAME: ${{ secrets.TENCENT_REGISTRY_USERNAME }}
      TENCENT_REGISTRY_PASSWORD: ${{ secrets.TENCENT_REGISTRY_PASSWORD }}
```

### 6.2 build.yml

```yaml
name: Docker Build

on:
  workflow_call:
    secrets:
      TENCENT_REGISTRY_USERNAME:
        required: true
      TENCENT_REGISTRY_PASSWORD:
        required: true
    outputs:
      image-tags:
        description: "Docker image tags"
        value: ${{ jobs.build.outputs.tags }}

env:
  TENCENT_REGISTRY: hkccr.ccs.tencentyun.com
  TENCENT_IMAGE_NAME: gdgeek/editor  # ← 改成你的项目

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      tags: ${{ steps.meta.outputs.tags }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Tencent Cloud Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.TENCENT_REGISTRY }}
          username: ${{ secrets.TENCENT_REGISTRY_USERNAME }}
          password: ${{ secrets.TENCENT_REGISTRY_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.TENCENT_REGISTRY }}/${{ env.TENCENT_IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/publish' }}
            type=raw,value=develop,enable=${{ github.ref == 'refs/heads/develop' }}
            type=raw,value=publish,enable=${{ github.ref == 'refs/heads/publish' }}
            type=raw,value=main,enable=${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master' }}

      - name: Generate build time
        id: build-time
        run: echo "time=$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')" >> "$GITHUB_OUTPUT"

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: BUILD_TIME=${{ steps.build-time.outputs.time }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 6.3 test.yml

```yaml
name: Test

on:
  workflow_call:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: npm ci || npm install

      - name: Run lint
        run: npm run lint

      - name: Run tests
        run: npm test
```

> test.yml 需要根据你的项目调整工作目录和命令。

### 6.4 Dockerfile

```dockerfile
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

ARG BUILD_TIME="unknown"

COPY . /usr/share/nginx/html

# 注入打包时间（需要 index.html 中包含 __BUILD_TIME__ 占位符）
RUN sed -i "s/__BUILD_TIME__/${BUILD_TIME}/g" /usr/share/nginx/html/index.html

RUN rm -rf /usr/share/nginx/html/.git \
    /usr/share/nginx/html/.github \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/docker-compose.yml \
    /usr/share/nginx/html/*.md

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 6.5 .dockerignore

```
.git
.github
.gitignore
.vscode
Dockerfile
docker-compose.yml
*.md
node_modules
LICENSE
```

## 7. 拉取镜像

```bash
# 开发版
docker pull hkccr.ccs.tencentyun.com/<命名空间>/<镜像名>:develop

# 主分支版
docker pull hkccr.ccs.tencentyun.com/<命名空间>/<镜像名>:main

# 发布版（也是 latest）
docker pull hkccr.ccs.tencentyun.com/<命名空间>/<镜像名>:publish
docker pull hkccr.ccs.tencentyun.com/<命名空间>/<镜像名>:latest
```

## 8. 适配新项目

1. 复制 `.github/workflows/` 目录、`Dockerfile`、`.dockerignore` 到新项目
2. 修改 `build.yml` 中的 `TENCENT_IMAGE_NAME` 为新项目的镜像名
3. 修改 `test.yml` 中的测试命令适配新项目
4. 在 GitHub Secrets 中配置腾讯云凭据
5. 如需打包时间，在 `index.html` 中加入 `__BUILD_TIME__` 占位符
