# How to run Profitlo

Profitlo is a website that runs in your browser. You don't need to install anything, create an account or get an API key.

---

## Use it online (no download)

Open **https://notoriouskapil.github.io/profitlo/** in any browser, on your phone or laptop.

To have your own copy, or to use it offline, follow one of the options below.

---

## Option 1: Download and double-click

1. Open the project page: **https://github.com/notoriouskapil/profitlo**
2. Click the green **Code** button, then **Download ZIP**.
3. Unzip the downloaded file (right-click → *Extract All* on Windows, double-click on Mac).
4. Open the `profitlo-main` folder and double-click **`index.html`**.

The app opens in your browser (Chrome, Edge, Firefox or Safari). That's it.

> Tip: on the Home tab, click **Load sample business** to see a full example straight away.

---

## Option 2: Run it with a local server

Use this for presentations or if anything looks wrong when opening the file directly.

**Step 1: get the code.** Either download the ZIP as in Option 1, or clone it with Git:

```bash
git clone https://github.com/notoriouskapil/profitlo.git
cd profitlo
```

**Step 2: start a server.** Pick whichever you have installed.

With Python 3 (built into Mac and most Linux; on Windows install it from python.org):

```bash
python3 -m http.server 8000
```

On Windows, if `python3` doesn't work, use `python -m http.server 8000`.

With Node.js:

```bash
npx serve .
```

**Step 3: open the app.** Go to **http://localhost:8000** in your browser (or the address `npx serve` prints).

To stop the server, press `Ctrl + C` in the terminal.

---

## Run the calculation tests (optional)

This needs [Node.js](https://nodejs.org) version 16 or newer.

```bash
node tests/run-tests.js
```

You should see `15 tests passed.`

---

## Using the app

| Tab | What to do there |
|---|---|
| **Home** | Read what the app does, or load one of the 3 sample businesses. |
| **Planner** | Fill in the 4 steps: Business Setup, Product Costs, Monthly Expenses, Sales & Pricing. Then press **Calculate results**. |
| **Dashboard** | See your startup investment, revenue, costs, profit or loss, margin, break-even point and charts. **Print / save as PDF** is at the bottom. |
| **Scenarios** | Move the sliders to try a different price, sales or costs, and save scenarios to compare. |
| **AI Insights** | Health score, how much money to arrange, risks and suggestions. |
| **How it works** | Every formula, worked out with your own numbers. |

Other things to know:

- The moon/sun button in the top-right switches between dark and light mode.
- Your inputs are saved automatically **in your own browser only**. Nothing is sent anywhere.
- To start over, go to **Planner → Reset form**.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Fonts look plain | You're offline. The app still works, it just uses system fonts. |
| Old numbers keep showing | Press **Reset form** in the Planner, or clear the site data in your browser. |
| `python3: command not found` | Try `python -m http.server 8000`, or just use Option 1. |
| Port 8000 already in use | Use another number, e.g. `python3 -m http.server 8080`, and open `http://localhost:8080`. |

---

All results are **estimates** based on the numbers you enter. They are not guaranteed outcomes or financial advice.
