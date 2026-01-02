# 使用官方的Nginx镜像作为基础镜像
FROM nginx:alpine

# 删除默认的Nginx配置文件
RUN rm -rf /usr/share/nginx/html/*

# 将项目文件复制到容器的Nginx目录中
COPY . /usr/share/nginx/html

# 清理不需要的文件（.dockerignore 应该已经排除，这里做二次清理）
RUN rm -rf /usr/share/nginx/html/.git \
    /usr/share/nginx/html/.github \
    /usr/share/nginx/html/.gitignore \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/docker-compose.yml \
    /usr/share/nginx/html/server.js \
    /usr/share/nginx/html/*.md

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 暴露80端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]