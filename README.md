# js_bumbleracing

## Play it now: https://pemmyz.github.io/js_bumbleracing/

# 🐝🌼🐝 Bee Flower Bee (Co-op)

A retro-styled browser game inspired by arcade classics and the bee arcade minigame from **GTA:SA**.  
Collect all the 🌼 flowers before the timer runs out, bounce off leaves 🌿, and avoid thorny 🌵 obstacles!  

Built with **HTML5, CSS3, and vanilla JavaScript** — no external libraries required.  

![screenshot](screenshots/game_1.png)

---

## 🎮 Gameplay

## 🎮 Controls

- **Player 1 (Keyboard)**
  - ⬅️➡️ `A / D` → Move left/right  
  - ⬆️ `W` or `Space` → Thrust upwards  

- **Player 2 (Keyboard — join anytime)**
  - Press `Arrow Up` to join  
  - ⬅️➡️ `Arrow Left / Arrow Right` → Move left/right  
  - ⬆️ `Arrow Up` → Thrust upwards  

---

### 🎮 Gamepad (P1 & P2)

> Gamepads are **auto-assigned** when you press any **face button** (`A/B/X/Y` on Xbox, `✕/○/□/△` on PlayStation).  
> First unclaimed pad becomes **P1**, the next becomes **P2** (and P2 will auto-join if the game is running).

- **Move left/right**
  - **Left Stick** (X-axis)  
  - **or** **D-Pad** Left / Right

- **Thrust upwards**
  - **A** (Xbox) / **✕** (PlayStation)  
  - **or** **Right Trigger (RT / R2)**  
  - **or** **Left Stick Up** (push above deadzone)

- **Notes**
  - Stick deadzone: **~0.2** (small movements are ignored)
  - If a gamepad disconnects, it’s **unassigned automatically** and the HUD will show `P1: GP?` / `P2: GP?`

---

### 🧩 Joining / Switching
- **Join with keyboard:** Press `Arrow Up` to add **Player 2** (keyboard).
- **Join with gamepad:** Press any **face button** on an unassigned controller to claim **P1** or **P2**.


- **Objectives**
  - Collect all 🌼 flowers before time runs out
  - Avoid thorny 🌵 clusters
  - Bounce off 🌿 platforms to stay airborne  

- **Progression**
  - Each level increases difficulty (more platforms, flowers, and thorns)
  - Extra life awarded every 3 levels
  - Score bonus for leftover time at the end of a level  

- **Co-op Mode**
  - Drop-in/out 2-player cooperative play
  - Both players share the same pool of lives
  - Camera adjusts dynamically to keep both players visible  

---

## 🕹️ Features

- Retro CRT screen effect with scanlines and glow  
- Pixel-perfect emoji-based graphics  
- **Dynamic cloud system** with drifting ☁️ and ⚡ thunderclouds  
- Physics: gravity, thrust, and bounce mechanics  
- Randomized level generation for endless replayability  
- **HUD with two-player support**:  
  - Score (P1 + optional P2)  
  - Level  
  - Flowers left  
  - Timer  
  - Shared Lives (🐝 icons)  
- **Message & overlay screens**:  
  - Start / Game Over screen  
  - Level transition messages  
  - Help screen with instructions  

---

## 🛠️ Developer Mode

Enable **Developer Mode** for debugging:

- Toggle with **`J` key**  
- Shows collision hitboxes  
- Displays a **DEV MODE** indicator on HUD  
- Extra dev hotkey:  
  - **`N` key** → Skip to next level  

---

## ❓ Help & Controls Overlay

- In-game help screen (`H` key or external **Help (H)** button)  
- Explains objectives, controls, dangers, lives, and hotkeys  
- Player 2 can join anytime by pressing ⬆️ Arrow  

---

## 📸 Screenshots

*(Add screenshots here once you have them!)*  

---

## 💡 Future Ideas

- 🎵 Add retro sound effects & background music  
- 🌩️ Thunder cloud hazards (lightning strikes?)  
- 🌍 Online leaderboard for high scores  
- 📱 Mobile touch controls  
- 🐸 Secret "AMIGAAA!" frog mode  

---

## 📜 License

MIT License  
Free to play, modify, and share.
