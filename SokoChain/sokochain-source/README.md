# SokoChain

เกม Sokoban แปดด่านสำหรับ Avalanche Fuji ผู้เล่นเลือกด่านได้ทันที แก้เกมใน browser แล้วส่งลำดับการเดินหนึ่งธุรกรรมให้ smart contract ตรวจทุกก้าว สถิติเก็บแยกตาม wallet และด่าน

| ด่าน | กล่อง | จำนวนก้าวต่ำสุด |
| --- | ---: | ---: |
| 1 — First Push | 1 | 6 |
| 2 — Around the Pillar | 1 | 15 |
| 3 — Long Route | 1 | 23 |
| 4 — Winding Path | 1 | 20 |
| 5 — Crossroads | 1 | 21 |
| 6 — Narrow Return | 1 | 21 |
| 7 — Two-Box Planning | 2 | 41 |
| 8 — Tight Corners | 2 | 50 |

## รันในเครื่อง

```bash
npm install
copy .env.example .env
npm run dev
```

ก่อนเปิดการส่งคะแนน ให้แก้ `VITE_CONTRACT_ADDRESS` ใน `.env` เป็น address ที่ deploy จริงบน Fuji

## Deploy contract ด้วย Remix

1. เปิด `contracts/SokoChain.sol` ใน Remix และตั้ง Solidity compiler เป็น `0.8.30` พร้อม EVM Version `cancun`.
2. รัน `contracts/SokoChain_test.sol` ผ่าน Solidity Unit Testing plugin.
3. เชื่อม Core Wallet ที่อยู่บน Avalanche Fuji C-Chain แล้ว deploy `SokoChain`.
4. ใส่ contract address ใหม่ใน `.env` แล้วรัน `npm run build` ใหม่. Contract V2 ใช้ `submitSolution(levelId, moves)` จึงใช้ address ของ V1 ไม่ได้.

## เผยแพร่บน Vercel

คุณสามารถ deploy โปรเจกต์นี้ขึ้น Vercel ได้โดยตรง:
1. Push code ขึ้น GitHub repository
2. Import repository ใน Vercel
3. ตั้ง environment variable \`VITE_CONTRACT_ADDRESS\`
4. Deploy ผ่าน Vercel (รองรับ HTTPS และเชื่อมต่อ Core Wallet ได้โดยตรง)

## Attribution

ด่าน 7 และ 8 ดัดแปลงจากชุดด่าน Microban ของ David W. Skinner ซึ่งเผยแพร่เป็น public domain.
