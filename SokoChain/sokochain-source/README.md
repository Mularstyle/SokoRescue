**English** | [ภาษาไทย (Thai version)](README.th.md)

<p align="center">
  <img src="docs/images/logo.png" alt="SokoRescue" width="720">
</p>

# SokoRescue

A flood-rescue puzzle game where every move matters. Steer the rescue boat, push food supplies through flooded streets, and deliver them to the marked rescue points.

SokoRescue was built at [Team1 Thailand — Codebase Hackathon: Chula Edition](https://build.avax.network/events/b6bc9762-afc9-416d-b21e-9795750663d1) and won the **Gaming Track**.

**[Play on Vercel →](https://rescuesoko.vercel.app/)**

![SokoRescue gameplay](docs/images/gameplay.png)

## How does it work?

SokoRescue is a skill-based Sokoban game with eight missions. Pick a level, plan your route, and push every food crate onto a rescue point without trapping it.

Once a mission is complete, the game sends your move sequence to a smart contract on Avalanche Fuji. The contract replays every move, checks that the solution is valid, and saves your best score for that level.

The browser cannot simply claim a high score — the puzzle solution itself is verified on-chain.

## How to play

### 1. Pick a mission

Start with **First Push**, or jump straight into any of the eight levels. The later missions add tighter routes and multi-crate planning.

### 2. Deliver the supplies

Use the arrow keys or the on-screen controls to move the rescue boat. Push every food crate onto a GPS rescue marker. You can restart the mission whenever a crate gets stuck.

### 3. Save your score

Connect Core Wallet on Avalanche Fuji. After solving a mission, confirm one transaction to submit the full move sequence. Your personal best and the level's world record are read back from the contract.

## Missions

| Mission | Crates | Verified minimum |
| --- | ---: | ---: |
| First Push | 1 | 6 moves |
| Around the Pillar | 1 | 15 moves |
| Long Route | 1 | 23 moves |
| Winding Path | 1 | 20 moves |
| Crossroads | 1 | 21 moves |
| Narrow Return | 1 | 21 moves |
| Two-Box Planning | 2 | 41 moves |
| Tight Corners | 2 | 50 moves |

## Run locally

Requires Node.js and npm.

```sh
npm install
copy .env.example .env
npm run dev
```

Set `VITE_CONTRACT_ADDRESS` in `.env` to the deployed `SokoChain` contract on Avalanche Fuji before submitting scores.

Run the checks with:

```sh
npm test
npm run build
```

Built with TypeScript, Vite, viem, Solidity, Core Wallet, and Avalanche Fuji.

## Credits

Levels 7 and 8 are adapted from David W. Skinner's public-domain Microban puzzle collection.

