import re

content = open('backend/services/sign_tasks.py', 'r', encoding='utf-8').read()
matches = list(re.finditer(r'\"\"\"', content))
print("Total number of triple quotes:", len(matches))
for i, m in enumerate(matches):
    print(f"Match {i+1}: at index {m.start()}, line {content[:m.start()].count(chr(10)) + 1}")
    if i > 0 and i % 2 == 1:
        print("--- (Closed pair expected here) ---")
