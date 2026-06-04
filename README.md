# Liquid Editor for Obsidian

**Liquid Editor** is a highly polished Obsidian plugin designed to make your writing environment feel more fluid, responsive, and "alive." It replaces the static, jarring elements of the default editor with smooth, hardware-accelerated animations and intelligent behaviors inspired by modern editors like VS Code.

---

## ✨ Features

### VS Code Style Smooth Caret
The default cursor in Obsidian can feel robotic. Natural Feel replaces it with a custom-rendered "Fake Caret" that moves with fluid, GPU-accelerated transitions.
- **Fluid Movement:** The caret glides between characters and lines with a customizable duration.
- **Smart Blinking:** Choose between classic, fade, or expansion blink animations.
- **Responsive Feel:** Animations can be paused while you move the cursor for a "snappy" navigation experience.
- **Dynamic Sizing:** Automatically adjusts its height to match the text (including headings) for a pixel-perfect fit across all font sizes.

> ![Screenshot: Smooth Caret in Action](URL_TO_SMOOTH_CARET_IMAGE)
> *The smooth caret gliding across lines.*

### Natural Error Highlights
Default spellcheck underlines are thin and easily missed. Natural Feel identifies misspelled words and highlights them with subtle, rounded red boxes.
- **Entrance/Exit Animations:** Choose between **Fade** or **Expand** animations when an error is detected or corrected.
- **Typing Awareness:** Highlighting is debounced (delayed) while you type, so you aren't distracted by "ghost" errors before you finish a word.
- **Intelligent Boundaries:** Highlights are precisely scoped to words, respecting punctuation and formatting.

> ![Screenshot: Error Highlights](URL_TO_ERROR_HIGHLIGHT_IMAGE)
> *The error highlight expanding over a misspelled word.*

### Intelligent Cursor Hiding
Minimize distractions while typing. When enabled, your mouse cursor will automatically vanish the moment you start typing and reappear instantly when you move the mouse.

---

## ⚙️ Configuration

Every aspect of Natural Feel is customizable via the settings tab:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Enable Smooth Caret** | Toggle the VS Code style cursor. | `On` |
| **Caret Animation Duration** | Speed of the movement glide (in ms). | `80ms` |
| **Caret Color** | Customizable color to match your theme. | `#DADADA` |
| **Caret Blink Animation** | Choose between `None`, `Fade`, or `Expand`. | `None` |
| **Hide Cursor While Typing** | Automatically hide the mouse cursor. | `On` |
| **Appearance Delay** | How long to wait after typing before highlighting an error. | `500ms` |
| **Error Animation** | Choose how the red highlight appears (`Fade` or `Expand`). | `None` |

---

## Installation

### Via Community Plugins (Pending)
1. Open **Settings** > **Community Plugins**.
2. Click **Browse** and search for `Natural Feel`.
3. Click **Install**, then **Enable**.

### Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2. Create a folder named `liquid-editor` in your vault's `.obsidian/plugins/` directory.
3. Move the downloaded files into that folder.
4. Reload Obsidian and enable the plugin in settings.

---

# License
MIT

---

*Crafted with ❤️ to make writing feel natural.*
