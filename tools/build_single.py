"""merge/ 폴더를 HTML 파일 한 개로 묶는다(그림·물리 엔진을 파일 안에 넣음).
사용: python3 tools/build_single.py  → dist/qing-merge.html"""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root/"merge/index.html").read_text(encoding="utf-8")
matter = (root/"merge/matter.min.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
imgs = ["data:image/webp;base64," + base64.b64encode((root/f"merge/img/{i:02d}.webp").read_bytes()).decode() for i in range(1, 12)]

def must_replace(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)

out = must_replace(src, '<script src="matter.min.js"></script>',
                   "<script>/* matter-js 0.19.0, MIT License (c) Liam Brummitt and contributors */\n" + matter + "</script>\n"
                   "<script>window.__IMG=" + json.dumps(imgs) + ";</script>")
out = must_replace(out, 'src="img/11.webp"', f'src="{imgs[10]}"')
out = must_replace(out, 'im.src=`img/${String(i+1).padStart(2,"0")}.webp`;',
                   'im.src=window.__IMG[i];')
(root/"dist").mkdir(exist_ok=True)
(root/"dist/qing-merge.html").write_text(out, encoding="utf-8")
print("dist/qing-merge.html", round(len(out.encode())/1024), "KB")
