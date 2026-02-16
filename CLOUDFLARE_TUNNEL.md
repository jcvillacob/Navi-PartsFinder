# Publicar Navi-PartsFinder con Cloudflare Tunnel

## 1) Verifica que tu app local levanta correctamente

```bash
docker compose up -d --build
docker compose ps
```

## 2) Autentica `cloudflared` contra tu cuenta de Cloudflare

Este comando abre una URL para autorizar el túnel y guarda certificados en `./.cloudflared`.

```bash
mkdir -p .cloudflared
docker run --rm -it \
  -v "$PWD/.cloudflared:/home/nonroot/.cloudflared" \
  cloudflare/cloudflared:latest tunnel login
```

## 3) Crea el túnel y registra un subdominio

Reemplaza `navi-partsfinder` y `app.tudominio.com` por tus valores.

```bash
docker run --rm -it \
  -v "$PWD/.cloudflared:/home/nonroot/.cloudflared" \
  cloudflare/cloudflared:latest tunnel create navi-partsfinder

docker run --rm -it \
  -v "$PWD/.cloudflared:/home/nonroot/.cloudflared" \
  cloudflare/cloudflared:latest tunnel route dns navi-partsfinder app.tudominio.com
```

## 4) Obtén el token del túnel y pégalo en `.env`

```bash
docker run --rm -it \
  -v "$PWD/.cloudflared:/home/nonroot/.cloudflared" \
  cloudflare/cloudflared:latest tunnel token navi-partsfinder
```

Copia el token de salida en:

```env
CLOUDFLARED_TUNNEL_TOKEN=...
```

## 5) Ajusta CORS para tu dominio público

En `.env`, agrega tu dominio de Cloudflare a `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=http://localhost:3100,https://app.tudominio.com
```

## 6) Levanta el túnel junto con la app

```bash
docker compose --profile tunnel up -d
docker compose --profile tunnel ps
docker compose logs -f cloudflared
```

## 7) Verificación final

- Abre `https://app.tudominio.com`
- Verifica login y llamadas `/api`
- Si falla CORS, revisa `ALLOWED_ORIGINS` y reinicia backend:

```bash
docker compose restart backend
```
