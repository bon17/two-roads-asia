"""docs/question-bank.md의 티볼 문제를 tball/questions.js로 바꾼다.
사용: python3 tools/build_questions.py"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
md = (root/"docs/question-bank.md").read_text(encoding="utf-8")
md = md.split("## 불평등 조약 카드용")[0]
CIRC = "①②③④"
qs, part = [], ""
for line in md.splitlines():
    h = re.match(r"^## (.+)$", line)
    if h:
        part = h.group(1).split("(")[0].strip(); continue
    ex = re.match(r"^\s+- 💡 해설:\s*(.*)$", line)
    if ex and qs:
        qs[-1]["explain"] = ex.group(1).strip(); continue
    m = re.match(r"^(\d+)\. (.*)$", line)
    if not m: continue
    n, t = int(m.group(1)), m.group(2).strip()
    extra = "[보충]" in t
    t = t.replace("[보충]", "").strip()
    if t.startswith("[순서]"):
        body = t[len("[순서]"):].strip()
        prompt = "일어난 순서대로 눌러 보세요"
        if ":" in body:
            pre, body = body.split(":", 1); prompt = pre.strip() + " 눌러 보세요"; body = body.strip()
        items = [re.sub(r"\s*\(\d{4}\)$", "", x.strip()) for x in body.split("→")]
        years = [re.search(r"\((\d{4})\)", x) for x in body.split("→")]
        note = " → ".join(f"{a}({y.group(1)})" if y else a for a, y in zip(items, years))
        qs.append({"id": n, "part": part, "type": "order", "q": prompt, "items": items, "note": note, "extra": extra}); continue
    if t.startswith("[OX]"):
        mm = re.match(r"\[OX\]\s*(.*?)\s*→\s*\*\*([OX])\*\*\s*(\((.*)\))?$", t)
        assert mm, (n, t)
        qs.append({"id": n, "part": part, "type": "ox", "q": mm.group(1), "answer": mm.group(2), "note": mm.group(4) or "", "extra": extra}); continue
    mm = re.match(r"(.*?)\s*①(.*?)②(.*?)③(.*?)④(.*?)→\s*\*\*([①②③④])\*\*\s*(\((.*)\))?$", t)
    assert mm, (n, t)
    opts = [mm.group(i).strip() for i in range(2, 6)]
    qs.append({"id": n, "part": part, "type": "mc", "q": mm.group(1).strip(), "options": opts,
               "answer": CIRC.index(mm.group(6)), "note": mm.group(8) or "", "extra": extra})
assert len(qs) == 67, len(qs)
missing = [q["id"] for q in qs if not q.get("explain")]
assert not missing, ("해설 없는 문제", missing)
out = "/* docs/question-bank.md에서 자동으로 만든 파일. 직접 고치지 말고 tools/build_questions.py를 다시 실행하세요. */\nwindow.QUESTIONS = " + json.dumps(qs, ensure_ascii=False, indent=0) + ";\n"
(root/"tball/questions.js").write_text(out, encoding="utf-8")
from collections import Counter
print(len(qs), Counter(q["type"] for q in qs))
for q in qs:
    if q["type"]=="order" or q["note"]: print(q["id"], q["type"], q.get("items") or "", "|", q["note"])
