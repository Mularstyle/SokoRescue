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

    // ---------------------------------------------------------------------
    // Puzzle Bounty: AVAX escrow + commit-reveal claim.
    // ---------------------------------------------------------------------

    struct Bounty {
        address creator;
        uint8 levelId;
        uint64 deadline;
        bool solved;
        bool reclaimed;
        uint256 reward;
        bytes32 creatorCommit; // keccak256(abi.encode(moves, salt, creator, levelId))
        address winner;
    }

    struct Commitment {
        bytes32 hash; // keccak256(abi.encode(moves, salt, solver, bountyId))
        uint64 blockNumber;
    }

    uint256 public bountyCount;
    mapping(uint256 => Bounty) private bounties;
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

    /// @notice Lock `msg.value` AVAX as a reward for solving `levelId` before `deadline`.
    /// @param creatorCommit Hash of the creator's own solution, revealed only to reclaim after the deadline.
    function createBounty(uint8 levelId, bytes32 creatorCommit, uint64 deadline) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "No reward");
        require(levelId >= 1 && levelId <= 8, "Invalid level");
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
        require(_simulate(_loadLevel(bounty.levelId), moves), "Unsolved");

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
        require(bounty.creatorCommit == keccak256(abi.encode(moves, salt, msg.sender, uint256(bounty.levelId))), "Bad reveal");
        require(_simulate(_loadLevel(bounty.levelId), moves), "Unsolved");

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

    function _openBounty(uint256 bountyId) private view returns (Bounty storage bounty) {
        require(bountyId >= 1 && bountyId <= bountyCount, "No bounty");
        bounty = bounties[bountyId];
        require(!bounty.solved, "Already solved");
        require(!bounty.reclaimed, "Already reclaimed");
    }

    /// @dev Replays `moves` on `level`. Reverts on an illegal route, returns false if legal but unsolved.
    function _simulate(Level memory level, uint8[] calldata moves) private pure returns (bool) {
        require(moves.length > 0, "Unsolved");
        require(moves.length <= MAX_MOVES, "Too many moves");

        uint8 player = level.player;
        uint8[2] memory boxes = [level.box0, level.box1];
        for (uint256 i = 0; i < moves.length; i++) {
            player = _step(level, boxes, player, moves[i]);
        }

        for (uint8 boxIndex = 0; boxIndex < level.boxCount; boxIndex++) {
            if (!_hasBit(level.goals, boxes[boxIndex])) return false;
        }
        return true;
    }

    function _step(Level memory level, uint8[2] memory boxes, uint8 player, uint8 direction) private pure returns (uint8 next) {
        require(direction <= 3, "Invalid direction");

        (int8 dx, int8 dy) = _delta(direction);
        int16 nextX = int16(uint16(player % level.width)) + dx;
        int16 nextY = int16(uint16(player / level.width)) + dy;
        require(_isFloor(level, nextX, nextY), "Invalid move");
        next = uint8(uint16(nextY) * level.width + uint16(nextX));

        for (uint8 boxIndex = 0; boxIndex < level.boxCount; boxIndex++) {
            if (boxes[boxIndex] != next) continue;
            _push(level, boxes, boxIndex, nextX + dx, nextY + dy);
            break;
        }
    }

    function _push(Level memory level, uint8[2] memory boxes, uint8 boxIndex, int16 pushX, int16 pushY) private pure {
        require(_isFloor(level, pushX, pushY), "Invalid push");
        uint8 pushed = uint8(uint16(pushY) * level.width + uint16(pushX));
        for (uint8 otherIndex = 0; otherIndex < level.boxCount; otherIndex++) {
            require(otherIndex == boxIndex || boxes[otherIndex] != pushed, "Blocked box");
        }
        boxes[boxIndex] = pushed;
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
        require(levelId >= 1 && levelId <= 8, "Invalid level");
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
