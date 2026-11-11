# Infra Kubernetes — followmetravel (cluster OVH)

Namespace `followmetravel` sur le cluster OVH (`KUBECONFIG=C:\saad\oneiro-srv`).

| Composant | Accès interne (depuis l'API) | Accès externe |
|---|---|---|
| PostgreSQL 17 | `postgres.followmetravel.svc.cluster.local:5432` | aucun — `port-forward` |
| MinIO (S3) | `http://minio.followmetravel.svc.cluster.local:9000` | `https://s3-followmetravel.oneiro-lego.com` (lecture d'objets seulement) |
| Console MinIO | `minio:9001` | aucun — `port-forward` |
| API NestJS (`api/`) | `api.followmetravel.svc.cluster.local:3000` | `https://api-followmetravel.oneiro-lego.com` |

Bucket : `followmetravel`. Lecture anonyme des objets (`GetObject`) ; listing et
écriture anonymes refusés (403). Les URLs publiques des images ont la forme
`https://s3-followmetravel.oneiro-lego.com/followmetravel/<clé>`.

## Déployer / mettre à jour

```powershell
$env:KUBECONFIG = "C:\saad\oneiro-srv"
kubectl kustomize infra\k8s > $env:TEMP\fmt-infra.yaml
kubectl apply --dry-run=server -f $env:TEMP\fmt-infra.yaml
kubectl apply -f $env:TEMP\fmt-infra.yaml
```

Le Job `minio-bucket-init` est immuable : pour le relancer,
`kubectl -n followmetravel delete job minio-bucket-init` puis ré-appliquer.

## Secrets (hors git)

Créés une seule fois avec des mots de passe aléatoires :

```bash
kubectl -n followmetravel create secret generic postgres-credentials \
  --from-literal=POSTGRES_DB=followmetravel --from-literal=POSTGRES_USER=followmetravel \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 24)"
kubectl -n followmetravel create secret generic minio-credentials \
  --from-literal=MINIO_ROOT_USER=followmetravel-admin \
  --from-literal=MINIO_ROOT_PASSWORD="$(openssl rand -hex 24)"
```

Lire une valeur :

```powershell
kubectl -n followmetravel get secret postgres-credentials -o jsonpath="{.data.POSTGRES_PASSWORD}" |
  % { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

## API

Image `hamzashoul/followmetravel-api:<tag>` (Docker Hub, publique — aucun secret
dedans). Nouvelle version :

```powershell
docker build -t hamzashoul/followmetravel-api:<tag> api
docker push hamzashoul/followmetravel-api:<tag>
# puis newTag: "<tag>" dans infra/k8s/kustomization.yaml, et « Déployer » ci-dessus
kubectl -n followmetravel rollout status deploy/api
```

Les migrations SQL (`api/migrations/*.sql`) s'appliquent au démarrage du pod.

Configuration : ConfigMap `api-config` (dans `api.yaml`) + Secret `api-env` (hors git) :

| Clé de `api-env` | Contenu |
|---|---|
| `DATABASE_URL` | `postgres://followmetravel:<POSTGRES_PASSWORD>@postgres.followmetravel.svc.cluster.local:5432/followmetravel` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | utilisateur MinIO `followmetravel-api` (politique limitée au bucket) |
| `SMTP_URL` | `smtps://noreply%40followmetravel.ma:<mdp>@mail.followmetravel.ma:465` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | client OAuth Google (redirect : `<API_PUBLIC_URL>/v1/account/sessions/oauth2/callback/google`) |
| `RECAPTCHA_SECRET` | clé secrète reCAPTCHA v3 (sans elle, `POST /v1/reservations` répond 500) |
| `CRON_TOKEN` | `openssl rand -hex 32` — authentifie le CronJob `payment-reminders` |

Modifier une valeur puis redémarrer l'API :

```powershell
kubectl -n followmetravel patch secret api-env --type merge -p '{"stringData":{"SMTP_URL":"smtps://..."}}'
kubectl -n followmetravel rollout restart deploy/api
```

Premier administrateur :

```powershell
kubectl -n followmetravel exec deploy/api -- node dist/cli/create-user.js --email <email> --password <mdp> --name <nom> --admin
```

Smoke test (crée et supprime ses propres données ; deux comptes requis) :
`node api/scripts/smoke.mjs https://api-followmetravel.oneiro-lego.com <admin> <mdp> <client> <mdp>`

### Passage sur api.followmetravel.ma

1. Zone DNS cPanel : enregistrement A `api` → `5.39.71.95`.
2. Ajouter l'hôte `api.followmetravel.ma` à l'Ingress `api` (règle + TLS).
3. `api-config` : `API_PUBLIC_URL=https://api.followmetravel.ma`, `COOKIE_SAMESITE=lax`.
4. Google Cloud : ajouter le nouveau redirect URI.
5. Rebuild du front avec `VITE_API_URL=https://api.followmetravel.ma`.

Tant que l'API est sur `oneiro-lego.com` (site différent du front), le cookie
de session est `SameSite=None` : Safari et les navigateurs qui bloquent les
cookies tiers ne garderont pas la connexion.

## Tâches planifiées (`cronjobs.yaml`, heure de Casablanca)

| CronJob | Quand | Rôle |
|---|---|---|
| `payment-reminders` | 08:00 | Rappels d'échéance et relances de retard (règles : dashboard → Paramètres → Agence). Appelle l'API avec `CRON_TOKEN` (clé du Secret `api-env`). |
| `postgres-backup` | 02:30 | `pg_dump` compressé dans le volume `backups`, 14 jours conservés. |
| `media-backup` | 03:00 | Copie miroir du bucket MinIO dans le volume `backups`. |

Lancer une tâche à la main : `kubectl -n followmetravel create job manuel-1 --from=cronjob/postgres-backup`

### Sauvegardes

Le volume `backups` est sur le même nœud que la base : il protège d'une erreur
de manipulation, **pas d'une panne du serveur**. Le copier régulièrement ailleurs :

```powershell
$pod = kubectl -n followmetravel run backup-copy --image=busybox:1.37 --restart=Never --overrides='{\"spec\":{\"volumes\":[{\"name\":\"b\",\"persistentVolumeClaim\":{\"claimName\":\"backups\"}}],\"containers\":[{\"name\":\"c\",\"image\":\"busybox:1.37\",\"command\":[\"sleep\",\"600\"],\"volumeMounts\":[{\"name\":\"b\",\"mountPath\":\"/backups\"}]}]}}'
kubectl -n followmetravel cp backup-copy:/backups .\backups-followmetravel
kubectl -n followmetravel delete pod backup-copy
```

Restaurer un dump : `gunzip -c dump.sql.gz | kubectl -n followmetravel exec -i postgres-0 -- psql -U followmetravel -d followmetravel`
(sur une base vide, ou après accord : le dump recrée les tables).

## Accès depuis un poste

```powershell
kubectl -n followmetravel port-forward svc/postgres 5432:5432   # psql / DBeaver / Prisma
kubectl -n followmetravel port-forward svc/minio 9001:9001      # console http://localhost:9001
```

## Notes

- Image MinIO : `pgsty/minio` (fork maintenu). MinIO Inc. ne publie plus
  d'images publiques (quay.io/minio et docker.io/minio → 401).
- Stockage `local-path` sur l'unique nœud : **pas de réplication**. Prévoir une
  sauvegarde (pg_dump + `mc mirror`) avant la mise en production.
- Volumes en `Retain` : supprimer le StatefulSet ne supprime pas les données.
