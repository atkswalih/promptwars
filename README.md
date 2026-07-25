# RecoverAI 💚
### AI-Powered Recovery & Prevention Platform for Substance Use Disorders

> *"You're not alone. RecoverAI listens, understands, and guides — 24/7."*

Built for the **PromptWars Hackathon** using **Google Gemini 2.0 Flash** (multimodal).

---

## 🚀 Live Demo

**[→ Deploy to Netlify in 30 seconds](#deployment)**

---

## ✨ Features

| Feature | Description | AI Used |
|---|---|---|
| 🆘 **SOS Craving Support** | Instant coping strategies + grounding exercise | Gemini text + **vision** |
| 📋 **Daily Check-In** | Mood-aware personalized daily recovery plan | Gemini text |
| 🤝 **Caregiver Mode** | Scripts, action steps, escalation guidance for caregivers | Gemini text |

### SOS — The Flagship Feature
- User describes their craving/trigger in text
- **Optional**: Upload a photo of their environment — Gemini Vision analyzes visible triggers
- Returns: risk level, 3 coping strategies, a 60-second grounding exercise, help guidance

### Mood Check-In
- 5-level emoji mood selector
- Optional context text
- Gemini returns a personalized morning/afternoon/evening plan + affirmation
- Streak counter (localStorage) motivates daily engagement

### Caregiver Mode
- Separate UI persona (indigo theme)
- Returns: situation assessment, exact phrases to say/avoid, action steps, escalation signals, self-care reminder

---

## 🔑 API Key Setup

1. Get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open `gemini.js` and replace `'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'` with your key
   — **OR** —
   Use the ⚙️ settings button in the app header to paste your key at runtime

---

## 📁 File Structure

```
recover-ai/
├── index.html    # Semantic HTML shell + all tab markup
├── style.css     # Complete design system (dark theme, glassmorphism)
├── app.js        # All UI logic + response renderers
├── gemini.js     # Gemini API service (text + vision)
└── prompts.js    # Structured prompt templates
```

---

## 🚀 Deployment

### Netlify (30 seconds)
1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `recover-ai/` folder into the browser
3. Done — live URL instantly

### GitHub Pages
```bash
git init
git add .
git commit -m "RecoverAI MVP"
git remote add origin YOUR_REPO_URL
git push -u origin main
# Enable Pages in repo Settings → Pages → main branch
```

---

## 🧠 Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (zero dependencies, zero build step)
- **AI**: Google Gemini 2.0 Flash (text generation + vision/multimodal)
- **Storage**: `localStorage` (streak counter, API key override)
- **Fonts**: Inter (Google Fonts)
- **Deploy**: Static — any host works (Netlify, GitHub Pages, Vercel, etc.)

---

## 🎨 Design System

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#080d18` | Dark navy background |
| `--sos` | `#f43f5e` | SOS accent, pulsing button |
| `--safe` | `#10b981` | Success, low risk, streaks |
| `--caregiver` | `#818cf8` | Caregiver mode accent |
| `--checkin` | `#22d3ee` | Check-in, grounding exercises |

---

## 📞 Crisis Resources (hardcoded in UI)

- **988 Suicide & Crisis Lifeline**: Call or text 988
- **SAMHSA National Helpline**: 1-800-662-4357 (free, confidential, 24/7)
- **Crisis Text Line**: Text HOME to 741741
- **Emergency**: 911

---

## ⚠️ Disclaimer

RecoverAI is a supportive tool, not a replacement for professional medical or mental health treatment. Always consult licensed healthcare providers for substance use disorder treatment.
