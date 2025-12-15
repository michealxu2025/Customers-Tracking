# VisitTrack Pro

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置
本项目已预置后端服务地址和图片上传 Key，无需手动配置。

*   **数据后端**: 已连接至您的 Google Sheets。
*   **图片存储**: 已集成 ImgBB。

### 3. 启动项目
```bash
npm run dev
```

---

## 🚀 部署指南

本应用是纯静态前端项目，支持部署到任何云平台。

### 选项 A: Google Cloud (推荐)

在 Google Cloud 一个项目中，您可以部署多个此类应用。

#### 1. 使用 Cloud Run (容器化部署)
利用项目中的 `Dockerfile`，您可以将应用部署为 Cloud Run 服务。同一个 GCP 项目可以容纳无数个 Cloud Run 服务。

1.  **构建并提交镜像**:
    ```bash
    # 确保已安装 gcloud CLI 并登录
    gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/visittrack-pro
    ```

2.  **部署服务**:
    ```bash
    gcloud run deploy visittrack-pro \
      --image gcr.io/YOUR_PROJECT_ID/visittrack-pro \
      --platform managed \
      --region asia-northeast1 \
      --allow-unauthenticated
    ```
    *提示：如果您想部署第二个 App，只需更改服务名称（如将 `visittrack-pro` 改为 `visittrack-admin`）即可在同一项目中并存。*

#### 2. 使用 Firebase Hosting (静态托管)
这是最经济的方式（通常在免费额度内）。

1.  安装 Firebase CLI: `npm install -g firebase-tools`
2.  初始化: `firebase init hosting` (选择您的 GCP 项目)
    *   Public directory: `dist`
    *   Configure as a single-page app: `Yes`
3.  构建并部署:
    ```bash
    npm run build
    firebase deploy
    ```
    *提示：Firebase 支持 "多站点 (Multisites)" 功能，允许您在同一个项目中通过不同的子域名托管多个不同的 Web 应用。*

### 选项 B: 通用静态托管 (Netlify / Vercel)

1.  将代码推送到 GitHub。
2.  在平台后台导入仓库。
3.  设置 Build command: `npm run build`
4.  设置 Publish directory: `dist`

### 选项 C: 传统 Docker / VPS

1.  **构建镜像**:
    ```bash
    docker build -t visittrack-pro .
    ```

2.  **运行容器**:
    ```bash
    docker run -d -p 8080:80 --name my-app visittrack-pro
    ```

## 功能说明
*   **客户拜访记录**: 记录拜访日期、详情、照片。
*   **地理定位**: 自动获取当前 GPS 坐标并生成 Google Maps 链接。
*   **云端同步**: 数据实时保存至 Google Sheets。
