// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SokoChain {
    uint8 public constant MAX_MOVES = 128;

    struct Level {
        uint64 floor;
        uint64 goals;
        uint8 width;
        uint8 height;
        uint8 player;
        uint8 box0;
        uint8 box1;
        uint8 boxCount;
    }

    mapping(address => mapping(uint8 => uint16)) public bestMoves;
    mapping(uint8 => uint16) public globalBestMoves;
    mapping(uint8 => address) public globalBestPlayer;
    mapping(uint8 => uint256) public validSubmissions;
    mapping(address => bool) private hasSubmitted;
    uint256 public playerCount;

    event SolutionSubmitted(address indexed player, uint8 indexed levelId, uint16 moves, bool personalBest, bool globalBest);

    function submitSolution(uint8 levelId, uint8[] calldata moves) external {
        require(levelId >= 1 && levelId <= 8, "Invalid level");
        require(moves.length > 0, "Unsolved");
        require(moves.length <= MAX_MOVES, "Too many moves");

        Level memory level = _loadLevel(levelId);
        uint8 player = level.player;
        uint8[2] memory boxes = [level.box0, level.box1];

        for (uint256 i = 0; i < moves.length; i++) {
            uint8 direction = moves[i];
            require(direction <= 3, "Invalid direction");

            (int8 dx, int8 dy) = _delta(direction);
            int16 nextX = int16(uint16(player % level.width)) + dx;
            int16 nextY = int16(uint16(player / level.width)) + dy;
            require(_isFloor(level, nextX, nextY), "Invalid move");
            uint8 next = uint8(uint16(nextY) * level.width + uint16(nextX));

            for (uint8 boxIndex = 0; boxIndex < level.boxCount; boxIndex++) {
                if (boxes[boxIndex] != next) continue;
                int16 pushX = nextX + dx;
                int16 pushY = nextY + dy;
                require(_isFloor(level, pushX, pushY), "Invalid push");
                uint8 pushed = uint8(uint16(pushY) * level.width + uint16(pushX));
                for (uint8 otherIndex = 0; otherIndex < level.boxCount; otherIndex++) {
                    require(otherIndex == boxIndex || boxes[otherIndex] != pushed, "Blocked box");
                }
                boxes[boxIndex] = pushed;
                break;
            }
            player = next;
        }

        for (uint8 boxIndex = 0; boxIndex < level.boxCount; boxIndex++) {
            require(_hasBit(level.goals, boxes[boxIndex]), "Unsolved");
        }

        uint16 score = uint16(moves.length);
        uint16 previousBest = bestMoves[msg.sender][levelId];
        bool personalBest = previousBest == 0 || score < previousBest;
        if (personalBest) bestMoves[msg.sender][levelId] = score;

        uint16 previousGlobalBest = globalBestMoves[levelId];
        bool globalBest = previousGlobalBest == 0 || score < previousGlobalBest;
        if (globalBest) {
            globalBestMoves[levelId] = score;
            globalBestPlayer[levelId] = msg.sender;
        }

        if (!hasSubmitted[msg.sender]) {
            hasSubmitted[msg.sender] = true;
            playerCount++;
        }
        validSubmissions[levelId]++;
        emit SolutionSubmitted(msg.sender, levelId, score, personalBest, globalBest);
    }

    function _delta(uint8 direction) private pure returns (int8 dx, int8 dy) {
        if (direction == 0) return (0, -1);
        if (direction == 1) return (1, 0);
        if (direction == 2) return (0, 1);
        return (-1, 0);
    }

    function _isFloor(Level memory level, int16 x, int16 y) private pure returns (bool) {
        if (x < 0 || y < 0 || x >= int16(uint16(level.width)) || y >= int16(uint16(level.height))) return false;
        return _hasBit(level.floor, uint8(uint16(y) * level.width + uint16(x)));
    }

    function _hasBit(uint64 bits, uint8 index) private pure returns (bool) {
        return (bits & (uint64(1) << index)) != 0;
    }

    function _loadLevel(uint8 levelId) private pure returns (Level memory level) {
        if (levelId == 1) return Level(0x1f3e7cc9f00, 0x40000, 7, 7, 29, 24, 0, 1);
        if (levelId == 2) return Level(0x1f3a7cd9f00, 0x400, 7, 7, 32, 24, 0, 1);
        if (levelId == 3) return Level(0x1b3e4cf9f00, 0x400, 7, 7, 18, 31, 0, 1);
        if (levelId == 4) return Level(0x1f3a5cd0f00, 0x8000000000, 7, 7, 18, 32, 0, 1);
        if (levelId == 5) return Level(0x1d3c6cf8e00, 0x200000000, 7, 7, 17, 16, 0, 1);
        if (levelId == 6) return Level(0x1f147c38f00, 0x800, 7, 7, 17, 24, 0, 1);
        if (levelId == 7) return Level(0xde6d3f83003, 0x14000000000, 9, 6, 42, 24, 33, 2);
        return Level(0x73a7c48f00, 0x1000000800, 7, 7, 26, 24, 25, 2);
    }
}
