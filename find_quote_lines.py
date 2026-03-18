content = open('backend/services/sign_tasks.py', 'r', encoding='utf-8').read()
import re
lines = [content[:m.start()].count('\n') + 1 for m in re.finditer(r'\"\"\"', content)]
print(lines)
