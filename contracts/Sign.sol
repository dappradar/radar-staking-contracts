// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "hardhat/console.sol";

abstract contract Sign is EIP712 {
    constructor() EIP712("RADAR Cross-Chain Staking", "1") {}

    struct ActionData {
        bytes32 action;
        uint256 amount;
    }

    bytes32 private constant ACTION_DATA_TYPEHASH = keccak256("ActionData(bytes32 action,uint256 amount)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version)");
    bytes32 private constant DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256("RADAR Cross-Chain Staking"),
            keccak256("1")
        ));

    function hashActionData(ActionData memory actionData) private view returns (bytes32) {
        return keccak256(abi.encode(
                ACTION_DATA_TYPEHASH,
                actionData.action,
                actionData.amount
            ));
    }

    function verify(address user, ActionData memory actionData, bytes memory signature) public view virtual {
        bytes32 digest = _hashTypedDataV4(hashActionData(actionData));

        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(digest, signature);
//        console.log(error);
        console.log(recovered);
        require(error == ECDSA.RecoverError.NoError && recovered == user, "Sign: Invalid signature");
    }
}