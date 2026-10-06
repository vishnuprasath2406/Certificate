# 🪶 PIXEL-3.O E-Certificate Portal

> **National Level Technical Symposium E-Certificate System**  
> Organized by the **Department of Computer Science and Engineering**, **Adhiparasakthi Engineering College**, Melmaruvathur in association with **CSI (Computer Society of India) – Kanchipuram Chapter**.

---

## ✨ Features

- **🔥 Flying Phoenix Design**: Powered by the looping Phoenix background video, glowing radial fire atmospheric effect, and dynamic particle ember animation.
- **🎯 Pixel-Perfect Alignment**:
  - Participant name centered precisely on the certificate line (`x: 969, y: 605`, italic bold serif font `#0a1e6e`).
  - College name placed right on the college underline (`x: 794, y: 669`).
  - Event title placed right between the quotes (`x: 700, y: 727`).
  - Dynamic font autoscaling to comfortably fit long names without clipping.
- **⚡ All Working Options from Original Website**:
  - **Category Filter**: Technical vs Non-Technical arenas.
  - **Event Selection**: PaperQuest, AI FilmForge, Checkmate, Mine Relay.
  - **Smart Participant Lookup**: Instant search with autocomplete dropdown from `participants.csv`.
  - **Direct Name Search**: Simply type your name to look up your event and certificate across all categories.
  - **Manual Edit Mode**: Easily tweak spelling or on-spot registrations with instant canvas re-render.
  - **High-Definition Live Preview**: Rendered at native 1536 × 1024 resolution.
  - **Download PNG**: Instant crisp lossless image download.
  - **Download PDF**: Landscape PDF generated via `jspdf` for printing.
  - **Confetti Celebration**: Celebratory particle explosion upon certificate discovery.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally in Development
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## 📁 Project Structure

```text
Certificate/
├── public/
│   ├── phoenix.mp4             # Flying bird video background
│   ├── participation.png       # Official certificate template (1536x1024)
│   ├── Certificate-template.png
│   └── participants.csv        # Database of attendees (Name, College, Event)
├── src/
│   ├── components/
│   │   ├── CertificateSection.tsx # Certificate generator, search & download
│   │   └── PhoenixHeroGraphic.tsx # Phoenix video, embers & glow animation
│   ├── App.tsx                 # Main root layout
│   ├── index.css               # Tailwind & custom glow utilities
│   └── main.tsx                # React entrypoint
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## 📝 Updating Participants

To add or update participants, simply edit `public/participants.csv`:

```csv
name,college,event
Vishnu,Adhiparasakthi Engineering College,PaperQuest
Pavithran,Adhiparasakthi Engineering College,PaperQuest
Your Name,Your College,Your Event
```

---

## 🎓 Organized By
- **Department of Computer Science & Engineering**
- **Adhiparasakthi Engineering College**, Melmaruvathur – 603319
- In association with **CSI Kanchipuram Chapter**
- Date: **14 October 2026**
