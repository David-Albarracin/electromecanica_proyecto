# CAMBIO CLAVE AQUÍ: Usar Bullseye (Debian 11) en lugar de Buster (Debian 10)
FROM python:3.11-slim-bullseye 

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8111

CMD ["gunicorn", "mysite.wsgi:application", "--bind", "0.0.0.0:8111"]