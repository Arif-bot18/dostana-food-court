import re

with open('static/js/app.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

with open('static/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

ids_in_js = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", js_content))
ids_in_html = set(re.findall(r"id=['\"]([^'\"]+)['\"]", html_content))

missing = []
for el_id in ids_in_js:
    if el_id not in ids_in_html and el_id not in ['dostana-toast']:
        missing.append(el_id)

print(f"IDs in JS: {len(ids_in_js)}")
print(f"IDs in HTML: {len(ids_in_html)}")
print(f"Missing IDs in HTML: {missing}")
if len(missing) == 0:
    print("SUCCESS: 100% of DOM IDs in app.js match index.html elements!")
else:
    print("WARNING: Some IDs are missing")
