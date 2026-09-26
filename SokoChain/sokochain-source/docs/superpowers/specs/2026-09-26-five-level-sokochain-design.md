# SokoChain Eight-Level Design

## Goal

Expand SokoChain from one puzzle to eight independently selectable Sokoban levels. The browser simulates play locally, while a new contract on Avalanche Fuji validates the submitted move sequence and stores scores separately for every wallet and level.

The scope stays intentionally small for the hackathon: no unlock progression, NFT, token gate, multiplayer, or server-side leaderboard.

## Player Experience

- Show eight level buttons and allow every level to be selected immediately.
- Switching levels resets the board and the recorded move sequence for the newly selected level.
- Levels 1–6 have one box. Levels 7–8 have two boxes and require more planning.
- Keyboard arrows and on-screen direction buttons use the same movement function.
- Only successful moves are recorded. Walking into a wall, void cell, or blocked box does not increase the move count.
- The submit button becomes available only when every box is on a goal.
- After a successful transaction, refresh the wallet's best score and the global best score for the selected level.
- Keep the existing Core Wallet, Fuji network, Grotto Runtime SDK, and external-browser fallback behavior.

## Levels

Map symbols: `#` wall, space floor, `@` player, `$` box, `.` goal. Coordinates start at the top-left.

### Level 1 — First Push

Minimum: 6 moves. Canonical solution: `URRDRU`.

```text
#######
#     #
# ##. #
#  $  #
#@    #
#     #
#######
```

### Level 2 — Around the Pillar

Minimum: 15 moves. Canonical solution: `UUULLDDRDRUURUL`.

```text
#######
#  .  #
#  #  #
#  $  #
# # @ #
#     #
#######
```

### Level 3 — Long Route

Minimum: 23 moves. Canonical solution: `RDDLLRRUULLLDLDDRUUULUR`.

```text
#######
#  .  #
#   @ #
#  ## #
#  $  #
#  #  #
#######
```

### Level 4 — Winding Path

Minimum: 20 moves. Canonical solution: `RDDLDLLLUURRDULLDDRR`.

```text
#######
#    ##
## #@ #
#   # #
# # $ #
#   . #
#######
```

### Level 5 — Crossroads

Minimum: 21 moves. Canonical solution: `RDDLLULURRURDDULLDDRR`.

```text
#######
##   ##
# $@  #
#  #  #
##   .#
# #   #
#######
```

### Level 6 — Narrow Return

Minimum: 21 moves. Canonical solution: `LDDDRRUULRDDLLUUULURR`.

```text
#######
#   .##
#  @###
#  $  #
## # ##
#     #
#######
```

### Level 7 — Two-Box Planning

Minimum: 41 moves. Canonical solution: `RUULLLULDRRRRDDLURULLLDDLLLUURRDRDLUUURDD`.

```text
  ####
###  ####
#     $ #
# #  #$ #
# . .#@ #
#########
```

### Level 8 — Tight Corners

Minimum: 50 moves. Canonical solution: `DLULDDLLUUUURRRDULLLDDDDRRUULRDRRULUULLLDDDURRDRUU`.

```text
######
#   .#
# ## ##
#  $$@#
# #   #
#.  ###
#####
```

Levels 7 and 8 are adapted from David W. Skinner's public-domain Microban set. Keep attribution in the project README.

## Browser Data Model

Define each level once in TypeScript:

```ts
interface LevelDefinition {
  id: number;
  name: string;
  width: number;
  height: number;
  floor: ReadonlySet<number>;
  walls: ReadonlySet<number>;
  goals: ReadonlySet<number>;
  player: number;
  boxes: readonly number[];
  verifiedMinimumMoves: number;
}
```

`GameState` gains `levelId`, multiple `boxes`, and multiple `goals`. Remove singular level constants. Movement checks whether the destination contains a box; when it does, the next cell must be floor and must not contain another box. Victory requires every box position to be a goal.

The frontend and contract contain matching immutable level definitions. Tests replay each canonical solution in both implementations so a map change cannot silently make their rules diverge.

## Contract V2

Public interface:

```solidity
function submitSolution(uint8 levelId, uint8[] calldata moves) external;

mapping(address => mapping(uint8 => uint16)) public bestMoves;
mapping(uint8 => uint16) public globalBestMoves;
mapping(uint8 => address) public globalBestPlayer;
mapping(uint8 => uint256) public validSubmissions;
uint256 public playerCount;
```

Event:

```solidity
event SolutionSubmitted(
    address indexed player,
    uint8 indexed levelId,
    uint16 moves,
    bool personalBest,
    bool globalBest
);
```

Validation rules:

- Accept only level IDs 1–8 and at most 128 moves.
- `_loadLevel(levelId)` returns the immutable start state for that level.
- Represent playable cells and goals as `uint64` bitmaps. The largest map is 9×7, so every cell fits in 63 bits. Cells outside the playable floor are blocked.
- Represent positions as flattened `uint8` indexes. Use a two-element box array plus `boxCount` because the largest level has two boxes.
- Reject direction values outside `0=up`, `1=right`, `2=down`, `3=left`.
- Reject walking into blocked or void cells, pushing a box into blocked or void cells, and pushing one box into another.
- Require every box to finish on a goal.
- Update personal and global best values only when the new move count is lower; keep scores isolated by `levelId`.
- Track whether a wallet has ever submitted successfully so `playerCount` increases only once across all levels.
- Increase `validSubmissions[levelId]` and emit the event for every valid solution, even when it does not improve a record.

## Wallet and Data Flow

1. The player selects a level and plays it locally.
2. Completion is detected locally and the exact move sequence is retained.
3. The player connects Core Wallet and switches to Avalanche Fuji if needed.
4. The app calls `submitSolution(levelId, moves)`.
5. The app waits for the receipt, keeps the selected level visible, and refreshes its personal and global statistics.
6. After wallet connection, the app reads personal best values for all eight levels so the level picker can show completed levels.

Grotto supplies the display name only. On-chain identity remains the Core Wallet address. No cloud saves or browser-supplied leaderboard scores are added.

## Failure Handling

- A rejected or cancelled transaction preserves the solved board and move sequence so the player can retry.
- A read failure does not block local play; statistics show an unavailable state and can be refreshed.
- The existing external-browser wallet fallback includes both `levelId` and the move sequence.
- Invalid shared move data is discarded and starts the selected level cleanly.
- Deploying V2 creates a new contract address. The old V1 address must be replaced in the environment configuration before the production build.

## Verification

### TypeScript

- Parse and initialize every map correctly.
- Replay the canonical solutions with exact lengths 6, 15, 23, 20, 21, 21, 41, and 50.
- Verify box-to-box collision, a state with only one of two boxes solved, void cells, blocked pushes, invalid directions, level switching, and reset behavior.
- Verify the contract ABI and generated call include `levelId`.

### Solidity

- Compile with the Avalanche-supported Cancun EVM target.
- Accept the canonical solution for all eight levels.
- Reject invalid level IDs, more than 128 moves, blocked movement, box-to-box pushes, invalid directions, and unsolved endings.
- Verify scores are isolated by wallet and level.
- Verify a longer valid solution does not replace a better score.
- Verify `playerCount` increases once per wallet and per-level submission counts increase correctly.

### Browser and Deployment

- Test level selection, reset, keyboard controls, touch controls, two-box rendering, submit state, wallet connection, and responsive layout.
- Deploy V2 to Fuji, update the environment address and ABI, then rebuild.
- In a clean browser session, solve at least one single-box level and one two-box level, submit both, and confirm the explorer transactions and displayed per-level statistics.
- Upload the final production bundle to Grotto and repeat the embedded-game wallet or fallback flow.

## Delivery Sequence

1. Add level definitions and simulator tests.
2. Generalize the browser game state and UI for level selection and multiple boxes.
3. Implement and test contract V2.
4. Update wallet calls, ABI, statistics, and external-browser parameters.
5. Run the full test/build suite.
6. Deploy V2 to Fuji, update the address, perform clean-browser tests, and upload the production bundle to Grotto.
