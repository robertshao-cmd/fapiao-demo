# -*- coding: utf-8 -*-
"""
verify-demo.py — 商家端 demo 交付閘門(改了 merchant*/user.html 必跑)

    python checks/verify-demo.py        # exit 0 = 可交付;1 = 修好再交

擋的是這個 repo 實際踩過的雷(每一條都真的發生過,不是假想):
  1. 未來語氣的日期已過期(「下一個開獎日 7/25」在 7/28 還掛著)
  2. 同一指標兩個檔數字打架(助手回購 31% vs 參謀 34%)
  3. 統編三處不一致(登入頁 24567890 vs 開店頁 24549210)
  4. 「標杆店」措辭回滲(0728 口徑=商圈前 25% 聚合均值,去識別化)
  5. HTML 標籤壞損 / inline JS 語法錯(node 在才查,不在跳過並提示)
"""
import io, os, re, sys, subprocess, datetime
from html.parser import HTMLParser

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MERCHANT = ['merchant.html', 'merchant-app.html', 'merchant-analytics.html']
ALL = MERCHANT + ['user.html']
UBN = '24567890'   # 暖暖窩示範統編,三處必須一致

def read(f):
    return io.open(os.path.join(ROOT, f), encoding='utf-8').read()

def next_draw(today):
    """統一發票開獎=單數月 25 日。回傳 today 之後(不含當天)最近的一期 (m, d)。"""
    y, m = today.year, today.month
    for _ in range(14):
        if m % 2 == 1 and today < datetime.date(y, m, 25):
            return m, 25
        m += 1
        if m > 12:
            m, y = 1, y + 1
    raise RuntimeError('unreachable')

def main():
    problems, warnings = [], []
    today = datetime.date.today()
    nm, nd = next_draw(today)
    texts = {}
    for f in ALL:
        if not os.path.exists(os.path.join(ROOT, f)):
            problems.append('缺檔:%s' % f)
        else:
            texts[f] = read(f)
    if problems:
        for p in problems: print('❌ ' + p)
        return 1

    # ── 1. 日期 ──
    # 「下一個開獎日 / 下期開獎日 / 本期開獎日」後面的 M/D 必須 = 下一期
    for f, t in texts.items():
        for label, mm, dd in re.findall(r'(下一個開獎日|下期開獎日|本期開獎日)[^0-9]{0,20}(\d{1,2})/(\d{1,2})', t):
            if (int(mm), int(dd)) != (nm, nd):
                problems.append('[%s] 「%s %s/%s」不是下一期(今天 %s,下一期=%d/%d)'
                                % (f, label, mm, dd, today.strftime('%m/%d'), nm, nd))
    # 效期至 M/D 不得已過期(demo 裡掛過期券很難看)
    for f, t in texts.items():
        for mm, dd in re.findall(r'效期至\s*(\d{1,2})/(\d{1,2})', t):
            d = datetime.date(today.year, int(mm), int(dd))
            if d < today:
                warnings.append('[%s] 「效期至 %s/%s」已過期 —— demo 前換成未來日期' % (f, mm, dd))
    # 「今日 · M/D(週X)」要對:日期與星期都比對今天
    WD = '一二三四五六日'
    m = re.search(r'今日 · <b>(\d{1,2})/(\d{1,2})（(.)）', texts['merchant-app.html'])
    if m:
        mm, dd, w = int(m.group(1)), int(m.group(2)), m.group(3)
        want = datetime.date(today.year, mm, dd)
        if want != today:
            warnings.append('[merchant-app] 數據頁「今日 %d/%d」不是今天(%s)——demo 前更新'
                            % (mm, dd, today.strftime('%m/%d')))
        elif WD[want.weekday()] != w:
            problems.append('[merchant-app] %d/%d 是週%s,頁面寫（%s）' % (mm, dd, WD[want.weekday()], w))
    # 參謀「本週 MM/DD–MM/DD」不得比今天舊超過 14 天
    m = re.search(r'本週 (\d{2})/(\d{2})–(\d{2})/(\d{2})', texts['merchant-analytics.html'])
    if m:
        end = datetime.date(today.year, int(m.group(3)), int(m.group(4)))
        if (today - end).days > 14:
            warnings.append('[merchant-analytics] 「本週 %s」已是 %d 天前——demo 前更新'
                            % (m.group(0)[3:], (today - end).days))

    # ── 2. 跨檔數字一致 ──
    app, ana = texts['merchant-app.html'], texts['merchant-analytics.html']
    m1 = re.search(r'30 天回購率</div>\s*<div class="v">(\d+)%', app)
    m2 = re.search(r'回頭率（30 天）</span><b>(\d+)% vs (\d+)%', ana)
    if m1 and m2 and m1.group(1) != m2.group(1):
        problems.append('30 天回購:助手 %s%% vs 參謀 %s%% —— 同指標要同數字' % (m1.group(1), m2.group(1)))
    m3 = re.search(r'商圈義式平均 (\d+)%', app)
    if m2 and m3 and m2.group(2) != m3.group(1):
        problems.append('商圈均值:助手 %s%% vs 參謀 %s%%' % (m3.group(1), m2.group(2)))
    m4 = re.search(r'回頭客 (\d+)%', app)
    m5 = re.search(r'>(\d+)%</text>', ana)
    if m4 and m5 and m4.group(1) != m5.group(1):
        problems.append('回頭客占比:助手 %s%% vs 參謀 %s%%' % (m4.group(1), m5.group(1)))

    # ── 3. 統編 ──
    for f in MERCHANT:
        hits = set(re.findall(r'2\d{7}', texts[f]))
        bad = hits - {UBN}
        # 排除明顯非統編的 8 位數(如發票號碼 AB-58814920 的尾碼)——只查前後文有「統編/統一編號」的
        for b in list(bad):
            ctx = [texts[f][max(0, mm.start()-24):mm.start()] for mm in re.finditer(b, texts[f])]
            if not any(('統' in c or 'ubn' in c) for c in ctx):
                bad.discard(b)
        if bad:
            problems.append('[%s] 統編不一致:%s(應為 %s)' % (f, ', '.join(sorted(bad)), UBN))

    # ── 4. 口徑措辭 ──
    for f in MERCHANT:
        if '標杆' in texts[f]:
            problems.append('[%s] 出現「標杆」——0728 口徑=「商圈前 25% 聚合均值(去識別化)」' % f)
    if '前 25%' not in ana:
        problems.append('[merchant-analytics] 找不到「前 25%」——對比口徑被改掉了?')

    # ── 5. HTML / JS ──
    VOID = {'br','img','meta','link','input','hr','source','area','circle','text','path'}
    for f, t in texts.items():
        class P(HTMLParser):
            def __init__(s): super().__init__(); s.stack=[]; s.err=[]
            def handle_starttag(s, tag, a):
                if tag not in VOID: s.stack.append(tag)
            def handle_endtag(s, tag):
                if s.stack and s.stack[-1]==tag: s.stack.pop()
                elif tag in s.stack: s.err.append(tag)
        p = P(); p.feed(t)
        if p.stack: problems.append('[%s] 未關閉標籤:%s' % (f, p.stack[-3:]))
        if p.err:   problems.append('[%s] 標籤錯序:%s' % (f, p.err[:3]))
    try:
        import tempfile
        for f, t in texts.items():
            js = '\n;\n'.join(re.findall(r'<script>(.*?)</script>', t, re.S))
            with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tmp:
                tmp.write(js); path = tmp.name
            r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
            os.unlink(path)
            if r.returncode != 0:
                problems.append('[%s] inline JS 語法錯:%s' % (f, (r.stderr or '').strip().splitlines()[:1]))
    except FileNotFoundError:
        warnings.append('沒裝 node,跳過 JS 語法檢查(建議裝上,聯動 code 壞了這裡才抓得到)')

    # ── 報告 ──
    print('=' * 60)
    print('verify-demo — 商家端交付閘門(今天 %s,下一期開獎 %d/%d)' % (today, nm, nd))
    print('=' * 60)
    if warnings:
        print('\n⚠️  警告(%d,不擋交付):' % len(warnings))
        for w in warnings: print('  - ' + w)
    if problems:
        print('\n❌ 問題(%d):' % len(problems))
        for p in problems: print('  - ' + p)
        print('\n結果:FAIL — 修好再交付')
        return 1
    print('\n✅ 全過:日期新鮮、數字一致、統編一致、口徑正確、HTML/JS 完好')
    return 0

if __name__ == '__main__':
    sys.exit(main())
