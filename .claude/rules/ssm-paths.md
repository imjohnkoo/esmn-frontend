# SSM Parameter Store 경로 (전체 monorepo 공유)

> **상태 (2026-05-19, A-2c 완료 시점)**: 네임스페이스 = **`/nomacom/*`** (확정). 본 문서는 **확정값** — `deploy/scripts/after_deploy.sh` 가 직접 참조.
> **AWS 계정**: `059265294529` (nomacom 별도) · **Region**: `ap-northeast-2` · **CLI profile**: `nomacom` (IAM user `nomacom-infra`).
> **A-1 audit 정정**: 처음엔 "기존 nomacom SSM 부재" 로 판단했으나, A-2c 시점 list 결과 **2026-05-18 23 시경 nomacom-backend (NestJS esim-manager) 용 13개 키가 이미 등록됨** 을 발견. 본 frontend monorepo 와 같은 `/nomacom/*` 네임스페이스 공유. 충돌은 없지만 (키 이름 차이) 통합 정리 가능 — 아래 "공존 키" 표 참조.

프로덕션 환경변수는 **AWS SSM Parameter Store** 에서 관리합니다. Docker 이미지에 시크릿을 ARG/ENV 로 넣지 않습니다 (이미지 레이어 노출 위험). `deploy/scripts/after_deploy.sh` 가 런타임에 EC2 IAM role 권한으로 SSM 에서 가져와 `--env-file` 로 주입.

## SSM 경로 (확정 스키마)

| 경로 | 용도 | 키 (확정) | 비고 |
|---|---|---|---|
| `/nomacom/shared/db/` | DB 접속 (admin / client 공유 eSIM 메인 DB) | `DATABASE_URL` (단일 connection string 권장 — client 가 이미 사용) | client 는 `DATABASE_URL` 단일, admin 은 `DATABASE_URL` (eSIM 메인) + `ADMIN_DATABASE_URL` (admin 전용 DB) 2종 — admin 전용은 `/nomacom/admin/` 에 분리 |
| `/nomacom/shared/maya/` | Maya eSIM B2B API | `MAYA_API_ENDPOINT`, `MAYA_API_CLIENT_ID`, `MAYA_API_CLIENT_SECRET` | client `runtimeConfig` 키와 1:1 (`apps/client/CLAUDE.md` Env Vars) |
| `/nomacom/shared/docker/` | DockerHub login (after_deploy.sh) | `DOCKER_ID`, `DOCKER_PW` | **SecureString 필수**. PAT 권장 (account password 금지). 회전 정책 별도 |
| `/nomacom/shared/naver/` | 네이버 SmartStore Commerce API (admin OAuth 갱신 흐름 도입 시) | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_SOLUTION_ID` | admin `/api/esim/naver-oauth.get.ts` 는 현재 토큰 조회만 — 갱신 도입 시 필요. 보류 가능 |
| `/nomacom/shared/kakao/` | 카카오 알림톡 (벤더 미정) | TBD | 알림톡 도입 시 채움 (Infobip / LGCNS / NHN Toast 등) |
| `/nomacom/admin/` | **admin 전용** | `ADMIN_DATABASE_URL` (운영자 계정 DB), `NOMACOM_ADMIN_SESSION_SECRET` (인증 도입 시 — 보류), `APP_URL` | Dual DB 의 admin-only side. eSIM 메인은 `/nomacom/shared/db/DATABASE_URL` |
| `/nomacom/client/` | **client 전용** | `APP_URL`, `AUTH_TOKEN_MAX_AGE`, `NUXT_PUBLIC_*` mapping 대상 (A-4 에서 결정) · `NUXT_PUBLIC_PORTONE_STORE_ID` · `NUXT_PUBLIC_PORTONE_TEST_CHANNEL_KEY`(String — 공개값, `/checkout-preview` 전용 · W1-2 2026-09-23 · **미등록** — P9-7 에서 John 이 등록. 등록 전에 봉투 서버로 로컬 E2E-6 통과 + PortOne 콘솔에서 채널 테스트 모드 확인) | `after_deploy.sh` 는 SSM 키 이름 끝 토막을 그대로 env 이름으로 쓴다 → `NUXT_PUBLIC_` 로 시작하는 키는 별도 alias 없이 Nuxt runtimeConfig 를 런타임에 덮는다. ⚠️ `TEST_CHANNEL_KEY` 에는 테스트 채널키만(실채널키는 Phase 2 에서 다른 이름) |
| `/nomacom/mobile/` | **mobile 전용** (참고) | Expo EAS Secrets 채널 별도 — SSM 미사용 가능 | mobile 은 CodeDeploy 경로가 아님 |

## 공존 키 — nomacom-backend (NestJS) vs nomacom-frontend (Nuxt admin/client)

backend / frontend 가 같은 `/nomacom/*` 네임스페이스를 공유. **키 이름 차이로 충돌 없음**, 단 같은 외부 의존성 (DB, Maya) 의 값이 두 형식으로 중복 등록되어 있으므로 회전 시 양쪽 동시 갱신 필요.

| 외부 의존 | backend (NestJS) 형식 | frontend (Nuxt) 형식 |
|---|---|---|
| eSIM 메인 DB | `/nomacom/shared/db/DB_HOST` + `DB_PORT` + `DB_USERNAME` + `DB_PASSWORD` + `DB_DATABASE` (5 키) | `/nomacom/client/DATABASE_URL` (단일 URL) + `/nomacom/admin/ESIM_DATABASE_URL` |
| Maya API | `/nomacom/shared/maya/MAYA_API_CONNECTIVITY_V1_ENDPOINT` (+ `MAYA_API_CLIENT_ID`, `MAYA_API_CLIENT_SECRET` 공유) | `/nomacom/shared/maya/MAYA_API_ENDPOINT` (+ 같은 ID/SECRET 공유) |
| DockerHub | `/nomacom/shared/docker/DOCKER_PW` (5/18 등록, backend image push 권한 추정) | 동일 키 사용 — push 권한 호환 여부는 A-3 직전 검증 |
| Naver / Redis / SOLAPI | backend 전용 (`/nomacom/shared/naver-commerce/`, `/nomacom/shared/redis/`, `/nomacom/shared/solapi/`) | 미사용 |

**after_deploy.sh 동작**: `/nomacom/shared/` 전체 recursive fetch → admin 컨테이너 env 에 backend 키도 함께 주입됨. admin code 가 미사용 키는 단순 무시 — 무해. 향후 path 분리 검토 가능 (예: `/nomacom/backend/*` 로 분리).

## A-3 직전 실 등록 액션 (최소 admin 부팅용)

```bash
# 1) DockerHub PAT (SecureString)
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/docker/DOCKER_ID" \
  --value "imjohnkoo" --type SecureString --overwrite
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/docker/DOCKER_PW" \
  --value "dckr_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" --type SecureString --overwrite

# 2) eSIM 메인 DB
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/db/DATABASE_URL" \
  --value "postgres://user:pw@host:5432/esimmany" --type SecureString --overwrite

# 3) Maya API
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/maya/MAYA_API_ENDPOINT" \
  --value "https://api.maya.net/connectivity/v1" --type SecureString --overwrite
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/maya/MAYA_API_CLIENT_ID" \
  --value "xxx" --type SecureString --overwrite
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/shared/maya/MAYA_API_CLIENT_SECRET" \
  --value "xxx" --type SecureString --overwrite

# 4) admin 전용 (admin 운영자 DB — 별 RDS / schema)
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/admin/ADMIN_DATABASE_URL" \
  --value "postgres://..." --type SecureString --overwrite
aws ssm put-parameter --region ap-northeast-2 \
  --name "/nomacom/admin/APP_URL" \
  --value "https://admin.nomacom.example" --type String --overwrite
```

> `.claude/hooks/guard-prod-push.sh` 가 `aws ssm put|delete` 차단. A-3 작업 시 사용자 명시 승인 후 실행 또는 AWS 콘솔 수동 등록.

## EC2 IAM Role 권한 (A-3 직전 셋업)

EC2 인스턴스 프로필 role 에 다음 inline policy 추가:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:ap-northeast-2:<account-id>:parameter/nomacom/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "arn:aws:kms:ap-northeast-2:<account-id>:key/<ssm-default-key-or-cmk>"
    }
  ]
}
```

- AWS-managed default KMS key (`alias/aws/ssm`) 사용 시 KMS 권한이 자동으로 EC2 role 에 부여될 수도 있음 — 안전하게 명시 추가 권장
- 본 정책은 **read-only**. SSM put/delete 는 GHA 또는 별도 관리자 role 에서만

## Secret 네이밍 원칙 (m8 패턴 차용)

모든 암호화 비밀값은 **목적을 명시한 이름** 을 사용합니다. 일반적인 이름 (`CRYPTO_SECRET`, `JWT_SECRET`) 은 **금지**.

| 환경변수 예시 | 용도 | 알고리즘 |
|---|---|---|
| `NOMACOM_ADMIN_SESSION_SECRET` | admin 운영자 cookie session 서명 (도입 시) | HS256 |
| `NOMACOM_LOGIN_JWT_SECRET` | client 로그인 JWT 서명 (도입 시) | HS256 |
| `NOMACOM_PII_ENCRYPTION_KEY` | 주문/고객 PII 컬럼 암호화 (도입 시) | AES-256-GCM |
| `NOMACOM_EMAIL_CRYPTO_SECRET` | 이메일 주소 결정적 해시/암호화 (도입 시) | AES-256-CBC 또는 HMAC |
| `MAYA_API_CLIENT_SECRET` | Maya B2B 인증 토큰 (rotate 정책 필요) | — |

**원칙** (m8 에서 그대로 적용):
- secret 마다 **독립 보안 도메인**. JWT secret 을 OAuth credentials 암호화에 재사용 금지.
- 키 이름에 알고리즘 또는 용도 명시 (e.g. `_GCM` / `_JWT` / `_OAUTH` suffix).

## 로컬 개발

각 앱의 `.env.local` 파일 사용. 템플릿: `apps/admin/.env.example`, `apps/client/.env.example` (둘 다 신규 작성 필요 — 별도 task).

mobile 은 Expo 가 `EXPO_PUBLIC_*` prefix 환경변수를 빌드 시 인라인. 시크릿은 EAS Secrets 로 분리.

---

## audit 체크리스트 (A-1 결과)

- [x] 기존 nomacom-admin / nomacom-client-nuxt3 별도 repo 의 deploy 스크립트에서 SSM 경로 추출 → **별 SSM 경로 부재 확인** (`nomacom-esim-manager-v2` 가 Dockerfile ARG/ENV 패턴이었음). 단 nomacom-backend (NestJS esim-manager) 는 별개 — A-2c 시점 SSM list 에서 발견됨 (아래 참조)
- [x] AWS 콘솔 / CLI 로 실제 등록된 `/nomacom/*` 또는 다른 prefix 파라미터 목록 확인 → ⚠️ **2026-05-18 23 시경 nomacom-backend 용 13키 사전 등록 발견** (A-1 audit 시 m8-infra-readonly profile 로 점검해서 못 봤었음). frontend 용 6키 추가 등록 후 총 19키. 공존 표는 본 문서 상단 참조
- [ ] Maya / 네이버 / 카카오 알림톡 벤더 키 보유 여부 확인 → A-3 직전 SSM put 시점에 실값 확보 (Maya 는 운영 중인 v2 manager 에서 회수 가능)
- [ ] EC2 IAM role 이 SSM `GetParameters` + `Decrypt` 권한 보유 확인 → **A-3 직전 신규 EC2 launch 시 함께 셋업** (audit 메모 Q8 결정: 신규 EC2)
- [x] 본 문서 placeholder 값을 실제 경로로 교체 → A-2c 시점에 확정 스키마로 갱신 완료

---

## 변경 이력

- 2026-05-19 (A-2c 완료): STUB → 확정. `deploy/scripts/after_deploy.sh` 가 본 경로 직접 참조. audit 체크리스트 진행상황 갱신.
- 2026-05-19 (A-2c 실 SSM 등록): frontend 용 6키 (`/nomacom/client/DATABASE_URL`, `/nomacom/admin/ESIM_DATABASE_URL`, `/nomacom/shared/maya/MAYA_API_{ENDPOINT,CLIENT_ID,CLIENT_SECRET}`, `/nomacom/shared/docker/DOCKER_ID`) 등록 완료. **A-1 audit 정정**: nomacom-backend 용 SSM 키가 이미 존재한다는 사실 발견 — 13키 (DB_*/MAYA_*/NAVER_*/REDIS_*/SOLAPI_*/DOCKER_PW), 키 이름 차이로 충돌 없음. 공존 표 추가. 보류: `/nomacom/admin/DATABASE_URL` (운영자 DB 미생성), `/nomacom/admin/APP_URL` (EC2 launch 시).
