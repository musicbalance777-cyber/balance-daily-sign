# BALANCE v31 — Integrated Home v17

Combines the user-approved responsive v17 home with the full v30.1 app.
The home is rendered in an isolated same-origin iframe to preserve its exact CSS, responsive design and approved images.
The three envelope buttons send a same-origin postMessage to the existing showLetter() navigation in app-v29.mjs.
The v26 envelope animation CSS, letter/twig assets, message selection modules, and messages are unchanged.

Deploy the entire extracted directory to one HTTPS origin (e.g. GitHub Pages); do not open via file:// because ES modules and iframe origin restrictions may prevent it from working.

Check on phone: each envelope opens its matching letter, animation, back navigation, day persistence and channel link.
