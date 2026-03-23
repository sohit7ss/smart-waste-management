import sys

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "def camera_page():\n    html = \"\"\""
end_marker = "    \"\"\"\n    return HTMLResponse(content=html)"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    with open("new_html.txt", "r", encoding="utf-8") as f:
        new_html = f.read()
    
    new_content = content[:start_idx + len(start_marker)] + "\n" + new_html + "\n" + content[end_idx:]
    
    with open("main.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Success: Injected HTML")
else:
    print(f"Failed to find markers: start={start_idx}, end={end_idx}")
