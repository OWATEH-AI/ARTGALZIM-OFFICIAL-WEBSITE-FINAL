import os
import glob

def main():
    directory = r"c:\Users\LYKART06\Downloads\MY WEBSITES PROJ\ARTGALZIM WEB"
    html_files = glob.glob(os.path.join(directory, "*.html"))
    
    replacements = [
        (
            "<p>Mverechena Business Center<br/>Domboshava, Zimbabwe</p>",
            "<p>ARTGALZIM CENTER<br/>Mverechena Business Center<br/>Domboshava, Zimbabwe</p>"
        ),
        (
            '<span class="meta-val">Mverechena Center, Domboshava</span>',
            '<span class="meta-val">ARTGALZIM CENTER, Mverechena Center, Domboshava</span>'
        ),
        (
            '<p style="color: var(--text-muted); font-size: 1.05rem; margin-top: 2px;">Mverechena Business Center, Domboshava<br>27km North of Harare Centre</p>',
            '<p style="color: var(--text-muted); font-size: 1.05rem; margin-top: 2px;">ARTGALZIM CENTER<br>Mverechena Business Center, Domboshava<br>27km North of Harare Centre</p>'
        ),
        (
            '<p>Mverechena Business Center, Domboshava.',
            '<p>ARTGALZIM CENTER, Mverechena Business Center, Domboshava.'
        )
    ]
    
    for file_path in html_files:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        new_content = content
        for old_str, new_str in replacements:
            new_content = new_content.replace(old_str, new_str)
            
        if new_content != content:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Updated: {os.path.basename(file_path)}")

if __name__ == "__main__":
    main()
