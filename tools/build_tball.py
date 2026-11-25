"""tball/ 을 HTML 파일 한 개로 묶는다(그림·Firebase·QR·문제를 파일 안에 넣음).
사용: python3 tools/build_questions.py && python3 tools/build_tball.py → dist/tball.html
교사는 주소 끝에 #host 를 붙여 연다."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
t = root / "tball"
src = (t / "index.html").read_text(encoding="utf-8")
def js(p): return (root / p).read_text(encoding="utf-8").replace("</script", "<\\/script")
imgs = {p.stem: "data:image/webp;base64," + base64.b64encode(p.read_bytes()).decode() for p in sorted((t / "img").glob("*.webp"))}
def rep(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)
out = src
out = rep(out, '<script src="../vendor/firebase-bundle.js"></script>', "<script>/* Firebase JS SDK 10.14.1 (Apache-2.0) */\n" + js("vendor/firebase-bundle.js") + "</script>")
out = rep(out, '<script src="../vendor/qrcode.min.js"></script>', "<script>/* qrcode-generator 1.4.4 (MIT) Kazuhiko Arase */\n" + js("vendor/qrcode.min.js") + "</script>")
out = rep(out, '<script src="config.js"></script>', "<script>" + js("tball/config.js") + "</script>")
out = rep(out, '<script src="questions.js"></script>', "<script>" + js("tball/questions.js") + "</script>\n<script>window.__IMG=" + json.dumps(imgs) + ";</script>")
out = rep(out, '<script src="app.js"></script>', "<script>" + js("tball/app.js") + "</script>")
(root / "dist").mkdir(exist_ok=True)
(root / "dist/tball.html").write_text(out, encoding="utf-8")
print("dist/tball.html", round(len(out.encode()) / 1024), "KB")
