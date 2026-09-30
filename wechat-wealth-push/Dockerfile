# 后端服务镜像
FROM node:20-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package*.json ./
RUN npm install --omit=dev

# 再拷源码
COPY . .

RUN mkdir -p data

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]
