# 역사 티볼 리그: Firebase 설정 안내 (처음 한 번, 약 10분)

티볼 리그는 학생 태블릿 25~32대와 교실 TV를 실시간으로 이어야 해서 Firebase(구글의 무료 실시간 데이터베이스)를 씁니다.
학생은 계정이 필요 없습니다. 선생님 구글 계정으로 한 번만 만들면 됩니다.

> 무료 요금제(Spark)로 충분합니다. 동시 접속 100명까지 무료이고, 한 반(32명 + TV)은 그 안에 들어갑니다. 결제 정보를 넣지 마세요.

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 에 구글 계정으로 들어갑니다.
2. **프로젝트 만들기** → 이름은 예를 들어 `history-tball` → Google 애널리틱스는 **사용 안 함** → 만들기

## 2. 익명 로그인 켜기
학생이 계정 없이 들어오게 하는 설정입니다.
1. 왼쪽 메뉴 **빌드 → Authentication** → **시작하기**
2. **로그인 방법** 탭 → **익명** → **사용 설정** 켜기 → 저장

## 3. 실시간 데이터베이스 만들기
1. 왼쪽 메뉴 **빌드 → Realtime Database** → **데이터베이스 만들기**
2. 위치: **싱가포르 (asia-southeast1)** → 다음
3. **잠금 모드로 시작** → 사용 설정
4. 위쪽 **규칙** 탭을 눌러 원래 내용을 모두 지우고, 아래 규칙을 그대로 붙여 넣은 뒤 **게시**

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null",
        "meta": { ".write": "auth != null && (!data.exists() || data.child('host').val() === auth.uid)" },
        "state": { ".write": "auth != null && root.child('rooms').child($code).child('meta/host').val() === auth.uid" },
        "players": { "$id": { ".write": "auth != null && $id.matches(/^[0-9]{4}$/)" } },
        "answers": {
          ".write": "auth != null && root.child('rooms').child($code).child('meta/host').val() === auth.uid",
          "$pitch": { "$id": { ".write": "auth != null && !data.exists() && $id.matches(/^[0-9]{4}$/)" } }
        },
        "cardReq": { ".write": "auth != null" }
      }
    }
  }
}
```

이 규칙이 지켜 주는 것:
- 경기 진행(점수·판정)은 **방을 만든 교사 화면만** 바꿀 수 있습니다.
- 학생은 학번 4자리로만 들어올 수 있고, 한 문제에 **한 번만** 답할 수 있습니다(답 바꾸기 불가).

## 4. 웹 앱 설정값 받기
1. 왼쪽 위 **톱니바퀴 → 프로젝트 설정** → **일반** 탭 맨 아래 **내 앱**
2. 웹 아이콘 **`</>`** → 앱 닉네임 `tball` → **앱 등록** (Firebase 호스팅은 체크하지 않음)
3. 화면에 나온 `const firebaseConfig = { ... }` 부분을 **통째로 복사해서 Claude에게 보내 주세요.**
   - 이 값은 비밀번호가 아니라, 웹 페이지가 어느 Firebase에 연결할지 알려 주는 주소입니다. 페이지 안에 들어가 학생 기기에도 전달됩니다.
   - 실제 보안은 3번의 규칙이 지킵니다.
   - `databaseURL` 줄이 꼭 있어야 합니다. 없으면 3번(데이터베이스 만들기)을 마친 뒤 다시 복사하세요.

## 5. 그다음 (Claude가 함)
받은 설정값을 `tball/config.js`에 넣고 `dist/tball.html`을 다시 만들어 드립니다. 선생님은 그 파일을 Netlify Drop에 올리면 됩니다.

## 수업 때 쓰는 법
- **교사 TV**: 올린 주소 끝에 `#host`를 붙여 엽니다. 예: `https://tball-2반.netlify.app/#host`
- **학생**: TV에 뜬 QR을 갤럭시탭 카메라로 찍고 학번 4자리를 누릅니다.
- 교사 화면을 새로 고쳐도 같은 방으로 돌아옵니다(같은 컴퓨터, 같은 브라우저일 때).

## 잘 안 될 때
- 학생 화면에 "연결에 실패했어요"가 뜨면: Authentication → **설정 → 승인된 도메인**에 Netlify 주소(예: `tball-2반.netlify.app`)를 추가해 보세요.
- 화면 아래에 "연습 모드" 띠가 보이면: 아직 Firebase 설정값이 들어가지 않은 파일입니다.
