import re

content = open('services.html', 'r', encoding='utf-8').read()

pattern = r'(<div class="activity-grid reveal-stagger">)\s*<div class="activity-card">\s*<div class="activity-icon">&#127912;</div>\s*<h3>Art Mentorship programme</h3>.*?</div>\s*<div class="activity-card">\s*<div class="activity-icon">&#127912;</div>\s*<h3>Art Sessions</h3>.*?</div>\s*<div class="activity-card">\s*<div class="activity-icon">&#127863;</div>\s*<h3>Sip and Paint</h3>.*?</div>\s*(<div class="activity-card">)'

new_combined = (
    r'\1\n'
    '      <div class="activity-card">\n'
    '        <div style="display: flex; gap: 0.5rem; font-size: 1.8rem; margin-bottom: 0.75rem;">&#127912; &#127863;</div>\n'
    '        <h3>Art Sessions &amp; Sip and Paint</h3>\n'
    '        <p>Short, intensive art sessions focusing on specific techniques from charcoal sketching to contemporary oil painting. Or unwind with our social Sip and Paint experience while creating your own masterpiece with The Domboshava rooftop view.</p>\n'
    '        <div style="margin-top: 1.25rem; padding: 1rem; background: rgba(201,168,76,0.08); border-left: 2px solid var(--gold); border-radius: 4px; font-size: 0.9rem; color: var(--text-muted); line-height: 1.9;">\n'
    '          <strong style="color: var(--gold); display: block; margin-bottom: 0.4rem;">$15 Per Session</strong>\n'
    '          &#10003; Art Materials Included<br>\n'
    '          &#10003; Starlink Free Wi-Fi<br>\n'
    '          &#10003; The Domboshava Rooftop View and Experience\n'
    '        </div>\n'
    '      </div>\n'
    r'      \2'
)

new_content = re.sub(pattern, new_combined, content, flags=re.DOTALL)
if new_content != content:
    open('services.html', 'w', encoding='utf-8').write(new_content)
    print('Done - cards merged successfully')
else:
    print('No match found')
