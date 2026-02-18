# RPLAY Creator Collab Bot

RPLAY 크리에이터 라운지를 위한 Discord 협업 요청 봇입니다.

## 기능

### /협업요청
크리에이터 간 협업을 요청하는 슬래시 커맨드입니다.

**사용법:**
```
/협업요청 대상:@유저
/협업요청 대상:@유저 메시지:함께 작업하고 싶습니다!
```

**흐름:**
1. 요청자가 `/협업요청` 실행
2. 비공개 채널 생성 (대상자만 접근 가능)
3. 대상자에게 수락/거절 버튼 표시
4. **수락 시**: 요청자가 채널에 초대되어 협업 시작
5. **거절 시**: 요청자에게 DM으로 알림 후 채널 삭제

### 자동 채널 정리
- 90일 이상 비활성 채널 자동 삭제
- 매일 자정(UTC) 실행

### 헬스 체크
- `GET /` - 봇 상태 확인
- `GET /health` - 헬스 체크 엔드포인트

## 설치

```bash
npm install
```

## 환경 변수

`.env` 파일을 생성하고 다음 값을 설정하세요:

```env
TOKEN=Discord_Bot_Token
CLIENT_ID=Discord_Application_ID
GUILD_ID=Discord_Server_ID
PORT=3000  # 선택사항
```

## 실행

```bash
npm start
```

## 기술 스택

- Node.js 20+
- discord.js v14
- Express (헬스 체크)
- node-cron (스케줄링)
- winston (로깅)

## 로그

- `error.log` - 에러 로그
- `combined.log` - 전체 로그

## 라이선스

ISC
