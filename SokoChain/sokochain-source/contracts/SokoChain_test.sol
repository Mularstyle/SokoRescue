// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "remix_tests.sol";
import "./SokoChain.sol";

contract SokoChainTest {
    SokoChain private game;

    function beforeEach() public {
        game = new SokoChain();
    }

    function testCanonicalSolutions() public {
        _submit(1, "URRDRU");
        _submit(2, "UUULLDDRDRUURUL");
        _submit(3, "RDDLLRRUULLLDLDDRUUULUR");
        _submit(4, "RDDLDLLLUURRDULLDDRR");
        _submit(5, "RDDLLULURRURDDULLDDRR");
        _submit(6, "LDDDRRUULRDDLLUUULURR");
        _submit(7, "RUULLLULDRRRRDDLURULLLDDLLLUURRDRDLUUURDD");
        _submit(8, "DLULDDLLUUUURRRDULLLDDDDRRUULRDRRULUULLLDDDURRDRUU");

        Assert.equal(uint256(game.bestMoves(address(this), 1)), 6, "level one score");
        Assert.equal(uint256(game.bestMoves(address(this), 2)), 15, "level two score");
        Assert.equal(uint256(game.bestMoves(address(this), 3)), 23, "level three score");
        Assert.equal(uint256(game.bestMoves(address(this), 4)), 20, "level four score");
        Assert.equal(uint256(game.bestMoves(address(this), 5)), 21, "level five score");
        Assert.equal(uint256(game.bestMoves(address(this), 6)), 21, "level six score");
        Assert.equal(uint256(game.bestMoves(address(this), 7)), 41, "level seven score");
        Assert.equal(uint256(game.bestMoves(address(this), 8)), 50, "level eight score");
        Assert.equal(game.playerCount(), 1, "one wallet is one player");
    }

    function testLongerSolutionDoesNotReplaceBest() public {
        _submit(1, "URRDRU");
        _submit(1, "URRDLRRU");
        Assert.equal(uint256(game.bestMoves(address(this), 1)), 6, "longer route must not replace best");
        Assert.equal(uint256(game.globalBestMoves(1)), 6, "global best stays six");
        Assert.equal(game.validSubmissions(1), 2, "valid submissions are counted");
    }

    function testRejectsBlockedMove() public {
        uint8[] memory moves = new uint8[](1);
        moves[0] = 3;
        try game.submitSolution(1, moves) {
            Assert.ok(false, "walking into outer wall must revert");
        } catch {
            Assert.ok(true, "blocked move reverted");
        }
    }

    function testRejectsUnsolvedRoute() public {
        uint8[] memory moves = new uint8[](2);
        moves[0] = 0; moves[1] = 1;
        try game.submitSolution(1, moves) {
            Assert.ok(false, "unsolved route must revert");
        } catch {
            Assert.ok(true, "unsolved route reverted");
        }
    }

    function testRejectsInvalidDirection() public {
        uint8[] memory moves = new uint8[](1);
        moves[0] = 4;
        try game.submitSolution(1, moves) {
            Assert.ok(false, "unknown direction must revert");
        } catch {
            Assert.ok(true, "unknown direction reverted");
        }
    }

    function testRejectsMoreThan128Moves() public {
        uint8[] memory moves = new uint8[](129);
        try game.submitSolution(1, moves) {
            Assert.ok(false, "oversized route must revert");
        } catch {
            Assert.ok(true, "oversized route reverted");
        }
    }

    function testRejectsInvalidLevel() public {
        uint8[] memory moves = new uint8[](1);
        try game.submitSolution(6, moves) {
            Assert.ok(false, "unknown level must revert");
        } catch {
            Assert.ok(true, "unknown level reverted");
        }
    }

    function _submit(uint8 levelId, string memory route) private {
        game.submitSolution(levelId, _moves(route));
    }

    function _moves(string memory route) private pure returns (uint8[] memory moves) {
        bytes memory characters = bytes(route);
        moves = new uint8[](characters.length);
        for (uint256 i = 0; i < characters.length; i++) {
            if (characters[i] == bytes1("U")) moves[i] = 0;
            else if (characters[i] == bytes1("R")) moves[i] = 1;
            else if (characters[i] == bytes1("D")) moves[i] = 2;
            else moves[i] = 3;
        }
    }
}
