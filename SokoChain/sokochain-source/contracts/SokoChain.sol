// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SokoChain {
    uint16 public constant MAX_MOVES = 400;
    uint8 public constant MAX_SIZE = 10;
    uint8 public constant MIN_SIZE = 3;
    uint8 public constant MAX_BOXES = 6;

    /// @dev Up to 10x10 cells; cell index = y * width + x. Bit i of a board is cell i.
    struct Level {
        uint128 floor;
        uint128 goals;
        uint128 boxes;
        uint8 width;
        uint8 height;
        uint8 player;
    }

    mapping(address => mapping(uint8 => uint16)) public bestMoves;
    mapping(uint8 => uint16) public globalBestMoves;
    mapping(uint8 => address) public globalBestPlayer;
    mapping(uint8 => uint256) public validSubmissions;
    mapping(address => bool) private hasSubmitted;
    uint256 public playerCount;

    // ---------------------------------------------------------------------
    // Puzzle Bounty: AVAX escrow + commit-reveal claim.
    // ---------------------------------------------------------------------

    struct Bounty {
        address creator;
        uint8 levelId; // 1..8 preset, 0 = custom map (see getBountyLevel)
        uint64 deadline;
        bool solved;
        bool reclaimed;
        uint256 reward;
        bytes32 creatorCommit; // keccak256(abi.encode(moves, salt, creator, levelKey))
        address winner;
    }

    struct Commitment {
        bytes32 hash; // keccak256(abi.encode(moves, salt, solver, bountyId))
        uint64 blockNumber;
    }

    uint256 public bountyCount;
    mapping(uint256 => Bounty) private bounties;
    mapping(uint256 => Level) private customLevels;
    mapping(uint256 => mapping(address => Commitment)) public commitments;

    event BountyCreated(uint256 indexed bountyId, address indexed creator, uint8 indexed levelId, uint256 reward, uint64 deadline);
    event Committed(uint256 indexed bountyId, address indexed solver, bytes32 commitHash);
    event BountySolved(uint256 indexed bountyId, address indexed winner, uint256 reward, uint16 moves);
    event BountyReclaimed(uint256 indexed bountyId, address indexed creator, uint256 reward);

    event SolutionSubmitted(address indexed player, uint8 indexed levelId, uint16 moves, bool personalBest, bool globalBest);

    function submitSolution(uint8 levelId, uint8[] calldata moves) external {
        require(_simulate(_loadLevel(levelId), moves), "Unsolved");

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

    /// @notice Lock `msg.value` AVAX as a reward for solving preset level `levelId` before `deadline`.
    /// @param creatorCommit keccak256(abi.encode(moves, salt, creator, uint256(levelId))), revealed only to reclaim.
    function createBounty(uint8 levelId, bytes32 creatorCommit, uint64 deadline) external payable returns (uint256 bountyId) {
        require(levelId >= 1 && levelId <= 8, "Invalid level");
        bountyId = _createBounty(levelId, creatorCommit, deadline);
    }

    /// @notice Lock `msg.value` AVAX as a reward for solving a creator-designed map (up to 10x10).
    /// @param creatorCommit keccak256(abi.encode(moves, salt, creator, uint256(keccak256(abi.encode(level))))).
    function createCustomBounty(Level calldata level, bytes32 creatorCommit, uint64 deadline) external payable returns (uint256 bountyId) {
        _validateLevel(level);
        bountyId = _createBounty(0, creatorCommit, deadline);
        customLevels[bountyId] = level;
    }

    /// @notice Step 1 of claiming: publish only a hash of the answer. Re-committing overwrites.
    function commit(uint256 bountyId, bytes32 commitHash) external {
        Bounty storage bounty = _openBounty(bountyId);
        require(block.timestamp <= bounty.deadline, "Expired");
        require(commitHash != bytes32(0), "No commit");
        commitments[bountyId][msg.sender] = Commitment(commitHash, uint64(block.number));
        emit Committed(bountyId, msg.sender, commitHash);
    }

    /// @notice Step 2 of claiming (a later block): reveal the answer; first valid reveal wins the reward.
    function reveal(uint256 bountyId, uint8[] calldata moves, bytes32 salt) external {
        Commitment memory commitment = commitments[bountyId][msg.sender];
        require(
            commitment.hash != bytes32(0) && commitment.hash == keccak256(abi.encode(moves, salt, msg.sender, bountyId)),
            "Bad reveal"
        );
        require(commitment.blockNumber < block.number, "Reveal too early");
        Bounty storage bounty = _openBounty(bountyId);
        require(block.timestamp <= bounty.deadline, "Expired");
        require(_simulate(getBountyLevel(bountyId), moves), "Unsolved");

        // Effects before interaction.
        bounty.solved = true;
        bounty.winner = msg.sender;
        uint256 reward = bounty.reward;
        delete commitments[bountyId][msg.sender];
        emit BountySolved(bountyId, msg.sender, reward, uint16(moves.length));

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "Transfer failed");
    }

    /// @notice After the deadline, an unsolved bounty returns to its creator, who must
    /// prove the level was solvable by revealing the solution committed at creation.
    function reclaim(uint256 bountyId, uint8[] calldata moves, bytes32 salt) external {
        Bounty storage bounty = _openBounty(bountyId);
        require(msg.sender == bounty.creator, "Not creator");
        require(block.timestamp > bounty.deadline, "Not expired");
        Level memory level = getBountyLevel(bountyId);
        require(bounty.creatorCommit == keccak256(abi.encode(moves, salt, msg.sender, _levelKey(bounty.levelId, level))), "Bad reveal");
        require(_simulate(level, moves), "Unsolved");

        bounty.reclaimed = true;
        uint256 reward = bounty.reward;
        emit BountyReclaimed(bountyId, msg.sender, reward);

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "Transfer failed");
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        require(bountyId >= 1 && bountyId <= bountyCount, "No bounty");
        return bounties[bountyId];
    }

    /// @notice The map a bounty is played on (preset or custom).
    function getBountyLevel(uint256 bountyId) public view returns (Level memory) {
        require(bountyId >= 1 && bountyId <= bountyCount, "No bounty");
        uint8 levelId = bounties[bountyId].levelId;
        return levelId == 0 ? customLevels[bountyId] : _loadLevel(levelId);
    }

    function _createBounty(uint8 levelId, bytes32 creatorCommit, uint64 deadline) private returns (uint256 bountyId) {
        require(msg.value > 0, "No reward");
        require(creatorCommit != bytes32(0), "No commit");
        require(deadline > block.timestamp, "Bad deadline");

        bountyId = ++bountyCount;
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            levelId: levelId,
            deadline: deadline,
            solved: false,
            reclaimed: false,
            reward: msg.value,
            creatorCommit: creatorCommit,
            winner: address(0)
        });
        emit BountyCreated(bountyId, msg.sender, levelId, msg.value, deadline);
    }

    function _openBounty(uint256 bountyId) private view returns (Bounty storage bounty) {
        require(bountyId >= 1 && bountyId <= bountyCount, "No bounty");
        bounty = bounties[bountyId];
        require(!bounty.solved, "Already solved");
        require(!bounty.reclaimed, "Already reclaimed");
    }

    /// @dev Preset bounties bind the creator commit to the level id, custom ones to the map itself.
    function _levelKey(uint8 levelId, Level memory level) private pure returns (uint256) {
        return levelId == 0 ? uint256(keccak256(abi.encode(level))) : uint256(levelId);
    }

    function _validateLevel(Level calldata level) private pure {
        require(
            level.width >= MIN_SIZE && level.width <= MAX_SIZE && level.height >= MIN_SIZE && level.height <= MAX_SIZE,
            "Bad size"
        );
        uint256 cells = uint256(level.width) * level.height;
        uint128 mask = uint128((uint256(1) << cells) - 1);
        require(level.floor & ~mask == 0, "Bad floor");
        require(level.goals & ~level.floor == 0 && level.boxes & ~level.floor == 0, "Off floor");
        require(
            level.player < cells && _hasBit(level.floor, level.player) && !_hasBit(level.boxes, level.player),
            "Bad player"
        );
        uint256 boxCount = _popcount(level.boxes);
        require(boxCount >= 1 && boxCount <= MAX_BOXES && boxCount == _popcount(level.goals), "Bad boxes");
        require(level.boxes != level.goals, "Already solved");
    }

    /// @dev Replays `moves` on `level`. Reverts on an illegal route, returns false if legal but unsolved.
    /// Boxes and goals have equal counts, so "every box on a goal" is exactly boxes == goals.
    function _simulate(Level memory level, uint8[] calldata moves) private pure returns (bool) {
        require(moves.length > 0, "Unsolved");
        require(moves.length <= MAX_MOVES, "Too many moves");

        uint8 player = level.player;
        uint128 boxes = level.boxes;
        for (uint256 i = 0; i < moves.length; i++) {
            (player, boxes) = _step(level, boxes, player, moves[i]);
        }
        return boxes == level.goals;
    }

    function _step(Level memory level, uint128 boxes, uint8 player, uint8 direction) private pure returns (uint8 next, uint128) {
        require(direction <= 3, "Invalid direction");

        (int8 dx, int8 dy) = _delta(direction);
        int16 nextX = int16(uint16(player % level.width)) + dx;
        int16 nextY = int16(uint16(player / level.width)) + dy;
        require(_isFloor(level, nextX, nextY), "Invalid move");
        next = uint8(uint16(nextY) * level.width + uint16(nextX));

        if (_hasBit(boxes, next)) boxes = _push(level, boxes, next, nextX + dx, nextY + dy);
        return (next, boxes);
    }

    function _push(Level memory level, uint128 boxes, uint8 from, int16 pushX, int16 pushY) private pure returns (uint128) {
        require(_isFloor(level, pushX, pushY), "Invalid push");
        uint8 pushed = uint8(uint16(pushY) * level.width + uint16(pushX));
        require(!_hasBit(boxes, pushed), "Blocked box");
        return (boxes & ~(uint128(1) << from)) | (uint128(1) << pushed);
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

    function _hasBit(uint128 bits, uint8 index) private pure returns (bool) {
        return index < 128 && (bits >> index) & 1 == 1;
    }

    function _popcount(uint128 bits) private pure returns (uint256 count) {
        while (bits != 0) {
            bits &= bits - 1;
            count++;
        }
    }

    function _loadLevel(uint8 levelId) private pure returns (Level memory level) {
        require(levelId >= 1 && levelId <= 8, "Invalid level");
        if (levelId == 1) return Level(0x1f3e7cc9f00, 0x40000, uint128(1) << 24, 7, 7, 29);
        if (levelId == 2) return Level(0x1f3a7cd9f00, 0x400, uint128(1) << 24, 7, 7, 32);
        if (levelId == 3) return Level(0x1b3e4cf9f00, 0x400, uint128(1) << 31, 7, 7, 18);
        if (levelId == 4) return Level(0x1f3a5cd0f00, 0x8000000000, uint128(1) << 32, 7, 7, 18);
        if (levelId == 5) return Level(0x1d3c6cf8e00, 0x200000000, uint128(1) << 16, 7, 7, 17);
        if (levelId == 6) return Level(0x1f147c38f00, 0x800, uint128(1) << 24, 7, 7, 17);
        if (levelId == 7) return Level(0xde6d3f83003, 0x14000000000, (uint128(1) << 24) | (uint128(1) << 33), 9, 6, 42);
        return Level(0x73a7c48f00, 0x1000000800, (uint128(1) << 24) | (uint128(1) << 25), 7, 7, 26);
    }
}
