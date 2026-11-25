/* Firebase 설정 (history-tball 프로젝트).
   이 값은 비밀번호가 아니라 연결할 주소다. 보안은 Firebase 규칙(docs/firebase-setup.md)이 지킨다.
   주소에 ?local 을 붙이면 Firebase 없이 '연습 모드'로 열린다(같은 브라우저 탭끼리만 연결). */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB3QMaWuBO096EAidROS6VeH1Az30-Foyo",
  authDomain: "history-tball.firebaseapp.com",
  databaseURL: "https://history-tball-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "history-tball",
  storageBucket: "history-tball.firebasestorage.app",
  messagingSenderId: "260985008562",
  appId: "1:260985008562:web:2fd654de5f04a7e254b4ab"
};
