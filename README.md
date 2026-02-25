# 🏥 医院点餐系统 (Hospital Meal Ordering System)

一个完整的医院患者点餐系统，包含患者端 Cordova APP 和后台管理系统。

## 项目结构

```
HopspitalOrder/
├── app/                    # Cordova 患者端 APP
│   ├── www/               # 前端页面
│   │   ├── css/           # 样式
│   │   ├── js/            # 逻辑
│   │   └── index.html     # 入口
│   └── config.xml         # Cordova 配置
├── server/                # 后端服务
│   ├── routes/            # API 路由
│   │   ├── auth.js        # 登录认证
│   │   ├── categories.js  # 分类管理
│   │   ├── dishes.js      # 菜品管理
│   │   ├── beds.js        # 床位管理
│   │   ├── orders.js      # 订单管理
│   │   └── upload.js      # 图片上传
│   ├── uploads/           # 上传文件目录
│   ├── database.js        # 数据库初始化
│   ├── index.js           # 服务入口
│   └── package.json
├── admin/                 # 后台管理系统前端
│   └── index.html         # 管理后台页面
└── README.md
```

## 技术栈

- **患者端 APP**: Cordova + 原生 HTML/CSS/JS（移动端适配）
- **后台管理**: 纯 HTML/CSS/JS 单页应用
- **后端服务**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **文件上传**: Multer

## 快速启动

### 1. 启动后端服务

```bash
cd server
npm install
npm start
```

服务启动后访问：
- API 服务：http://localhost:3000
- 后台管理：http://localhost:3000/admin

### 2. 后台管理登录

默认账号：
- 用户名：`admin`
- 密码：`admin123`

### 3. 患者端 APP

开发模式下，直接在浏览器打开 `app/www/index.html` 即可预览。

如需构建为手机 APP：
```bash
cd app
cordova platform add android   # 或 ios
cordova build
```

> 注意：患者端 APP 中的 API 地址默认为 `http://localhost:3000/api`，部署时需修改 `app/www/js/index.js` 中的 `API_BASE` 变量。

## 功能特性

### 患者端 APP
- 📋 按床位选择患者
- 🕐 选择餐次（早/午/晚餐）
- 🍽️ 分类浏览菜品，加入购物车
- 🛒 购物车管理，确认下单
- 📝 支持备注特殊饮食要求

### 后台管理系统
- 📊 数据概览（今日订单统计、营收）
- 📋 订单管理（查看、确认、配送流程）
- 📂 菜品分类管理（增删改查、排序、启禁用）
- 🍽️ 菜品管理（增删改查、上下架）
- 🛏️ 床位管理（科室、房间、床位、患者信息）

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 管理员登录 |
| `/api/categories` | GET/POST | 获取/添加分类 |
| `/api/categories/active` | GET | 获取启用分类 |
| `/api/categories/:id` | PUT/DELETE | 修改/删除分类 |
| `/api/dishes` | GET/POST | 获取/添加菜品 |
| `/api/dishes/available` | GET | 获取上架菜品 |
| `/api/dishes/:id` | PUT/DELETE | 修改/删除菜品 |
| `/api/beds` | GET/POST | 获取/添加床位 |
| `/api/beds/occupied` | GET | 获取有人床位 |
| `/api/beds/:id` | PUT/DELETE | 修改/删除床位 |
| `/api/orders` | GET/POST | 获取/创建订单 |
| `/api/orders/:id` | GET | 订单详情 |
| `/api/orders/:id/status` | PUT | 更新订单状态 |
| `/api/orders/stats/daily` | GET | 每日统计 |
| `/api/upload` | POST | 上传图片 |
