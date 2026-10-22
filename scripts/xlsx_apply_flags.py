"""
openpyxl ghi kiểu ô (<xf> trong xl/styles.xml) không kèm applyFont / applyFill /
applyBorder / applyNumberFormat; Excel trên máy dự án khi đó bỏ khung và màu nền.
Thêm các cờ đó vào file .xlsx đã lưu.
"""
import re, shutil, tempfile, zipfile

def add_apply_flags(path):
    tmp = tempfile.mktemp(suffix='.xlsx')
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'xl/styles.xml':
                xml = data.decode('utf-8')
                def fix(m):
                    xf = m.group(0)
                    for attr, key in (('applyNumberFormat', 'numFmtId'), ('applyFont', 'fontId'), ('applyFill', 'fillId'), ('applyBorder', 'borderId')):
                        if attr not in xf and re.search(rf'\b{key}="(?!0")\d+"', xf):
                            xf = xf.replace('<xf ', f'<xf {attr}="1" ', 1)
                    return xf
                i, j = xml.find('<cellXfs'), xml.find('</cellXfs>')
                xml = xml[:i] + re.sub(r'<xf [^>]*>', fix, xml[i:j]) + xml[j:]
                data = xml.encode('utf-8')
            zout.writestr(item, data)
    shutil.move(tmp, path)
