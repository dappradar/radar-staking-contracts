// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    constructor(address owner) ERC20("MockToken", "MockToken") {
        transferOwnership(owner);
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    } 
}