# RecoverAI 💚
### AI-Powered Recovery & Prevention Platform for Substance Use Disorders

> *"You're not alone. RecoverAI listens, understands, and acts — 24/7."*

**PromptWars Warm-Up Submission** · Built with Google Gemini 2.0 Flash · Zero backend · Deployable in 30 seconds

---

## 🎯 Chosen Vertical

**Healthcare / Mental Health — Substance Use Disorder (SUD) Recovery & Prevention**

Substance use disorders affect over **46 million Americans** and hundreds of millions globally. Recovery is not a single event — it is a daily, hourly, moment-to-moment process. The two most critical intervention points are:

1. **Acute craving moments** — when the risk of relapse is highest and professional support is unavailable
2. **Caregiver burnout** — when family members don't know what to say or do, and inadvertently make things worse

RecoverAI targets both points directly with AI that responds in seconds, not days.

---

## ❗ Problem Statement

| The Gap | Why It Matters |
|---|---|
| Therapists are unavailable at 2AM when cravings peak | Most relapses happen outside business hours |
| Caregivers say the wrong things out of fear and love | Untrained responses increase shame, which increases relapse risk |
| Crisis hotlines are reactive, not proactive | Users need daily support, not just emergency calls |
| Generic wellness apps don't understand addiction | Recovery requires trauma-informed, specialised language |

**RecoverAI fills this gap** with a compassionate AI companion that responds to each user's specific situation — not with pre-written scripts, but with contextually aware, dynamically generated support.

---

## 🤖 AI Logic Flow

### Feature 1 — SOS (Crisis Craving Support)

```
User Input (text + optional photo)
        │
        ▼
┌───────────────────────────────────────┐
│  GEMINI PROMPT — Role: Trauma-informed │
│  recovery support specialist           │
│                                       │
│  IF photo uploaded:                   │
│    → Gemini Vision analyses image     │
│    → Identifies visible triggers      │
│       (bottles, people, environment)  │
│    → References them in response      │
│                                       │
│  Structured JSON schema enforced:     │
│    · validation (emotional ack.)      │
│    · riskLevel: LOW | MEDIUM | HIGH   │
│    · copingStrategies[3]              │
│    · groundingExercise (60 sec.)      │
│    · helpGuidance                     │
└───────────────────────────────────────┘
        │
        ▼
app.js → parseGeminiJSON() → renderSOSResponse()
        │
        ▼
UI: Risk badge + 4 response cards rendered
```

### Feature 2 — Daily Check-In

```
User selects mood (1–5 emoji scale) + optional context
        │
        ▼
┌───────────────────────────────────────┐
│  GEMINI PROMPT — Role: Recovery coach  │
│                                       │
│  Inputs injected into prompt:         │
│    · Mood score (1=great, 5=crisis)   │
│    · Mood label ("Struggling" etc.)   │
│    · Free-text context                │
│    · Current streak from localStorage │
│                                       │
│  Structured JSON schema enforced:     │
│    · reflection (mood-aware, personal)│
│    · insight (specific, non-generic)  │
│    · dailyPlan[3] (morning/PM/eve.)   │
│    · triggerWarning                   │
│    · affirmation (personalised)       │
└───────────────────────────────────────┘
        │
        ▼
incrementStreak() called on success → localStorage updated
        │
        ▼
UI: 5 response cards + animated streak counter
```

### Feature 3 — Caregiver Mode

```
Caregiver describes situation in free text
        │
        ▼
┌───────────────────────────────────────┐
│  GEMINI PROMPT — Role: Specialist      │
│  counsellor trained in SUD families   │
│                                       │
│  Structured JSON schema enforced:     │
│    · assessment (situation + empathy) │
│    · whatToSay[3] (verbatim scripts)  │
│    · whatNotToSay[2] (with reasons)   │
│    · actionSteps[3] (now/24h/long)    │
│    · escalationSignals (911 triggers) │
│    · selfCare (caregiver wellbeing)   │
└───────────────────────────────────────┘
        │
        ▼
UI: Assessment + Say/Avoid two-column layout + Action steps
```

---

## 🧠 AI Decision-Making Process

### Why structured JSON output?
Generic text blobs are unpredictable in a UI. By instructing Gemini to return a strict JSON schema, we can:
- Render each field in purpose-built UI cards
- Guarantee a risk level badge is always present
- Gracefully degrade (`_raw` fallback) if parsing fails

### Why role-based system prompts?
Each feature uses a distinct professional persona injected into the prompt:
- **SOS**: *"trauma-informed recovery support specialist"* — urgent, warm tone
- **Check-In**: *"warm, encouraging recovery coach"* — motivating, celebratory
- **Caregiver**: *"specialist counsellor trained in SUD families"* — practical, non-preachy

This ensures tone-appropriate responses without post-processing.

### Why multimodal for SOS?
Visual environment is a primary trigger for relapse. A photo of a party, a bar, or even a family gathering communicates context that text alone cannot. Gemini Vision analyses the image and references specific visible elements in its coping strategies — making the advice feel genuinely personalised.

### Why localStorage for streak?
Streak tracking creates a daily commitment device — a lightweight behavioural nudge backed by psychology research (loss aversion, habit formation). No backend means no data privacy risk.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  BROWSER                        │
│                                                 │
│  index.html  ─── Semantic HTML + ARIA           │
│  style.css   ─── Dark navy design system        │
│  prompts.js  ─── AI prompt templates            │
│  app.js      ─── UI logic + response renderers  │
│  gemini.js   ─── API service layer              │
│                                                 │
│  localStorage: API key + streak counter         │
└───────────────────────┬─────────────────────────┘
                        │  HTTPS fetch()
                        ▼
        ┌───────────────────────────────┐
        │  Google Gemini API (v1beta)   │
        │  Model: gemini-2.0-flash      │
        │  Endpoint: generateContent    │
        │  Modality: text + vision      │
        └───────────────────────────────┘
```

**Design decisions:**
- **Zero backend** — entire app runs in the browser. No server, no database, no auth system. Deploy anywhere.
- **Zero dependencies** — no npm, no bundler, no framework. Open `index.html` and it works.
- **API key in localStorage** — never hardcoded in source, never sent to a server other than Google.
- **Graceful degradation** — if Gemini returns malformed JSON, a `_raw` fallback renders the plain text instead of crashing.
- **Rate-limit recovery** — 429 errors trigger a live countdown timer that automatically re-enables all submit buttons after the cooldown.

---

## 📋 Assumptions

| Assumption | Rationale |
|---|---|
| User has a valid Google AI Studio API key | Free, takes 2 minutes to create |
| App runs in a modern browser (Chrome/Firefox/Safari/Edge) | `fetch()` + `FileReader` + `localStorage` are universally supported |
| Internet connection is available | Required for Gemini API calls |
| User data privacy is handled by Google's API terms | App stores nothing server-side |
| Free-tier rate limits (~15 RPM) are acceptable for demo | Cooldown UX mitigates the UX impact |
| Crisis resources are supplementary, not primary | App directs to 988, SAMHSA, 911 for acute emergencies |

---

## ⚙️ Setup Instructions

### Prerequisites
- A modern browser (Chrome recommended)
- Node.js installed (for the local server) **OR** Python 3
- A Gemini API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Step 1 — Get the project
```powershell
# The project is already at:
C:\Users\Mohamed Swalih\.gemini\antigravity\scratch\recover-ai\
```

### Step 2 — Start the local server

**Option A — Node.js (recommended)**
```powershell
cd "C:\Users\Mohamed Swalih\.gemini\antigravity\scratch\recover-ai"
node server.js
# → Open: http://localhost:3000
```

**Option B — Python**
```powershell
cd "C:\Users\Mohamed Swalih\.gemini\antigravity\scratch\recover-ai"
python -m http.server 3000
# → Open: http://localhost:3000
```

### Step 3 — Configure API key
1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Click **⚙️** in the top-right corner
3. Paste your `AIzaSy...` key from Google AI Studio
4. Click **Save Key**

> The key is saved to `localStorage` only. It is never sent anywhere except directly to `generativelanguage.googleapis.com`.

---

## 🎬 Demo Instructions

### Recommended demo flow for judges (< 3 minutes)

**Step 1 — SOS Feature (90 seconds)**
1. App opens on **SOS tab** by default — point out the pulsing red button
2. Type in the textarea:
   ```
   I'm at a friend's house and everyone is drinking. The urge is really strong right now.
   ```
3. Optionally upload any image of a social environment
4. Click **Get Support Now**
5. Show: risk badge (🟡 Moderate), 3 coping strategies, 60-second grounding exercise, help guidance

**Step 2 — Check-In Feature (45 seconds)**
1. Click **📋 Check-In** tab
2. Click the **😟 Struggling** emoji
3. Type: `Rough day at work, feeling isolated`
4. Click **Get My Daily Plan**
5. Show: personalised reflection, morning/afternoon/evening plan, trigger warning, affirmation
6. Point out the **🔥 streak counter** incrementing

**Step 3 — Caregiver Feature (45 seconds)**
1. Click **🤝 Caregiver** tab
2. Type:
   ```
   My son relapsed after 6 months sober. He won't come out of his room. I don't know what to say without making it worse.
   ```
3. Click **Get Guidance**
4. Show: Say This / Avoid This two-column layout, action steps, escalation signals

**Step 4 — Architecture proof (15 seconds)**
1. Click **⚙️** settings — show key is in localStorage, not source code
2. Point out crisis hotlines hardcoded in the footer — app never replaces emergency services

---

## 📁 File Structure

```
recover-ai/
├── index.html    — Semantic HTML shell, ARIA labels, 3 tab panels, modal
├── style.css     — Dark navy design system, glassmorphism, animations
├── app.js        — All UI logic, state management, response renderers
├── gemini.js     — Gemini API service (text + vision, error handling)
├── prompts.js    — 3 structured prompt templates with JSON schemas
├── server.js     — Zero-dependency local dev server (Node.js)
├── .gitignore    — Protects secrets from version control
└── README.md     — This file
```

---

## 🚀 Deployment (Netlify — 30 seconds)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `recover-ai/` folder into the browser window
3. Copy the live URL
4. Open the deployed URL → click ⚙️ → enter your API key → done

---

## 📞 Crisis Resources (hardcoded in UI — always visible)

| Service | Contact |
|---|---|
| 988 Suicide & Crisis Lifeline | Call or text **988** |
| SAMHSA National Helpline | **1-800-662-4357** (free, 24/7, confidential) |
| Crisis Text Line | Text **HOME** to **741741** |
| Emergency | **911** |

---

## ⚠️ Disclaimer

RecoverAI is a supportive tool built for a hackathon demonstration. It is **not** a replacement for professional medical or mental health treatment. Always direct users in acute crisis to call 988 or 911.
