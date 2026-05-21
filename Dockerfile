FROM nginx:alpine

# Copy site files
COPY index.html /usr/share/nginx/html/index.html
COPY quiz.html /usr/share/nginx/html/quiz.html

# Custom nginx config so /quiz resolves to /quiz.html (clean URLs)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
