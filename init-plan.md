Here is the consolidated technical reference and a rapid 2-day execution plan to build **"Clawder"** (Tinder for OpenClaw Agents).

### Part 1: OpenClaw Repository & Tech Reference
**Repository:** [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
**Documentation:** [docs.openclaw.ai](https://docs.openclaw.ai)
**Moltbook (Community):** [moltbook.com](https://moltbook.com)

**Key Tech Specs (for integration):**
*   **Control Plane:** `ws://127.0.0.1:18789` (Gateway WebSocket)
*   **Agent Identity:** stored in `~/.openclaw/workspace/SOUL.md` and `AGENTS.md`
*   **API Surface:**
    *   `sessions_list`: To find active agents.
    *   `sessions_send`: To trigger a "Match" message.
    *   `node.invoke`: To execute local actions.
*   **Tailscale:** Use `gateway.tailscale.mode: "funnel"` for public HTTPS access during the hackathon.

---

### Part 2: "Clawder" – App Architecture (MVP)

**Concept:** A React-based web interface running alongside the Gateway. It reads `SOUL.md` files from a shared "Moltbook" registry (or mocked data for MVP) and lets your local agent "swipe" on them. A "Match" triggers your agent to send an intro message to that specific persona.

**Tech Stack:**
*   **Frontend:** Vite + React + TypeScript (Reusing OpenClaw's `ui` patterns).
*   **Styling:** Tailwind CSS + **Uiverse** Components.
*   **Motion:** Framer Motion (via **ReactBits**).
*   **Icons:** **Phosphor Icons**.
*   **Backend:** Your local OpenClaw Gateway (no new server needed).

---

### Part 3: The 2-Day "Issue Plan"

Here is your copy-paste issue tracker. Assign these immediately.

#### Day 1: The Shell & The Deck

**Issue #1: Project Scaffold & Asset Extraction**
*   **Goal:** Set up Vite project using OpenClaw fonts/colors.
*   **Task:**
    *   Initialize `pnpm create vite clawder --template react-ts`.
    *   Copy fonts/assets from `openclaw/ui` folder in the main repo.
    *   Install Phosphor Icons: `pnpm install @phosphor-icons/react`.
*   **Resources:**
    *   [OpenClaw UI Folder](https://github.com/openclaw/openclaw/tree/main/ui)

**Issue #2: The "Agent Card" Component (Uiverse Integration)**
*   **Goal:** Create the visual profile card.
*   **Task:**
    *   Don't build from scratch. Grab a cyberpunk/glassmorphism card from Uiverse.
    *   **Fields:** Avatar, Name (e.g., "Molty"), Model (e.g., "Claude 3.5 Sonnet"), and "Soul Snippet" (Bio).
    *   **Code Action:** Adapt the HTML/CSS from the link below into a React component.
*   **Resources:**
    *   [Uiverse: Glassmorphism Card](https://uiverse.io/Glassmorphism-Card) (or search "Profile Card").
    *   [Phosphor Icons](https://phosphoricons.com) (Use `Robot`, `Heart`, `X`, `ChatTeardrop`).

**Issue #3: The Swipe Mechanism (ReactBits)**
*   **Goal:** Implement the "Tinder" physics.
*   **Task:**
    *   Implement a deck swiper.
    *   **Code Action:** Use the "Stack" or "Tinder Cards" snippet from ReactBits or a lightweight wrapper like `react-tinder-card`.
*   **Resources:**
    *   [ReactBits: Stack Animation](https://reactbits.dev/components/stack) (Perfect for card decks).
    *   Alt: `pnpm install framer-motion`.

**Issue #4: Mock Data Generator (The "Meat")**
*   **Goal:** Generate 20 "fake" agents to swipe on.
*   **Task:**
    *   Create `data/agents.json`.
    *   Generate funny bios: "Prompt Engineer looking for high-context windows," "Molty looking for shell-mate."
    *   **Tech Detail:** Structure data to match OpenClaw's `SOUL.md` format so we can swap it for real data later.

#### Day 2: Wiring & "The Match"

**Issue #5: Gateway Connection (WebSocket)**
*   **Goal:** Connect the app to your local OpenClaw Gateway.
*   **Task:**
    *   Use the existing OpenClaw client (found in `openclaw/packages/client` or just raw WS).
    *   Connect to `ws://localhost:18789`.
    *   Authenticate (if auth is enabled).
*   **Resources:**
    *   [OpenClaw Gateway Protocol](https://github.com/openclaw/openclaw/blob/main/docs/gateway-protocol.md)

**Issue #6: The "It's a Match!" Logic**
*   **Goal:** Trigger an action when swiping Right.
*   **Task:**
    *   **Event:** On Swipe Right -> Trigger `openclaw agent --message "I just matched with [Name] who likes [Bio]. Write them a pickup line."`
    *   **Visual:** Overlay a "MATCHED" modal using a loud animation.
*   **Resources:**
    *   [Uiverse: Loaders](https://uiverse.io/loaders) (Use a heartbeat loader for the matching state).

**Issue #7: Chat Interface Reuse**
*   **Goal:** Embed the conversation view.
*   **Task:**
    *   Don't build a chat UI.
    *   iframe or component import the existing OpenClaw WebChat (`ui/webchat`) to show the resulting conversation after a match.

**Issue #8: Deployment (Tailscale Funnel)**
*   **Goal:** Show it to the world.
*   **Task:**
    *   Build the static app (`pnpm build`).
    *   Serve it via the OpenClaw Gateway static server OR just `npx serve -s dist`.
    *   Expose via Tailscale Funnel so other people on the forum can access it.
*   **Resources:**
    *   [Tailscale Funnel Docs](https://tailscale.com/kb/1223/funnel)

### Quick Snippets for your Devs

**Swiping Logic (Framer Motion approach):**
```tsx
import { motion, useMotionValue, useTransform } from "framer-motion";

export const SwipeCard = ({ children, onSwipe }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  
  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.x > 100) onSwipe("right");
        else if (offset.x < -100) onSwipe("left");
      }}
    >
      {children}
    </motion.div>
  );
};
```

**Soul/Bio Data Structure (Compatible with OpenClaw):**
```json
{
  "agentId": "molty-001",
  "name": "Molty Prime",
  "model": "claude-3-opus",
  "vibe": "chaotic-good",
  "soulPrompt": "You are a space lobster who loves efficient TypeScript.",
  "avatar": "https://avatars.githubusercontent.com/u/openclaw"
}
```