// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./LZ/LzApp.sol";
import "./LZ/NonBlockingLzApp.sol";

contract StakingRewardsProxy is NonblockingLzApp {
    using ERC165Checker for address;
    using SafeERC20 for IERC20;

    bytes32 constant internal ACTION_STAKE = "stake";
    bytes32 constant internal ACTION_WITHDRAW = "withdraw";
    bytes32 constant internal ACTION_CLAIM = "claim";

    uint16 public immutable controllerChainId = 10012;
    uint8 public paused = 0;
    address public controller;
    address public fund;
    IERC20 public immutable stakingToken;

    mapping(uint64 => bool) private nonceRegistry;
    mapping(address => bytes32) public actionInQueue;
    mapping(address => bytes) public signatures;
    mapping(address => uint256) public balances;

    event WithdrawalInitiated(address indexed user);
    event ClaimInitiated(address indexed user);

    event Withdrawn(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    modifier notPaused() {
        require(paused == 0, "RadarStakingProxy: Contract is paused");
        _;
    }

    modifier notInQueue(address account) {
        require(actionInQueue[account] == bytes32(0x0), "RadarStakingProxy: In queue already! Wait till the callback comes.");
        _;
    }

    constructor(address _endpoint, address _fund, address _controller, address _stakingToken) NonblockingLzApp(_endpoint) {
        require(_controller != address(0), "RadarStakingProxy: invalid controller address");
        require(_stakingToken != address(0), "RadarStakingProxy: invalid staking token address");
        require(_fund != address(0), "RadarStakingProxy: invalid fund address");

        controller = _controller;
        fund = _fund;
        stakingToken = IERC20(_stakingToken);
    }

    function _sendMessage(bytes32 _action, uint256 _amount, bytes memory _signature) internal {
        require(address(this).balance > 0, "StakingRewardsProxy: the balance of this contract is 0");

        bytes memory payload = abi.encode(msg.sender, _action, _amount, _signature);

        // use adapterParams v1 to specify more gas for the destination
        uint16 version = 2;
        uint256 gasForDestinationLzReceive = 350000;
        uint256 nativeForDst = 300000000; // hardcoded, to be improved in the future
        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive, nativeForDst, controller);

        // get the fees we need to pay to LayerZero for message delivery
        (uint256 messageFee, ) = lzEndpoint.estimateFees(controllerChainId, address(this), payload, false, adapterParams);

        require(address(this).balance >= messageFee, "StakingRewardsProxy: address(this).balance < messageFee. Fund this contract");

        _lzSend( // {value: messageFee} will be paid out of this contract!
            controllerChainId, // destination chainId
            payload, // abi.encode()'ed bytes
            payable(address(this)), // refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0), // future param, unused for this example
            adapterParams // v1 adapterParams, specify custom destination gas qty
        );
    }

    function stake(uint256 _amount, bytes memory _signature) external payable notPaused {
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;

        _sendMessage(ACTION_STAKE, _amount, _signature);
    }

    function withdraw(bytes memory _signature) external payable notPaused notInQueue(msg.sender) {
        require(balances[msg.sender] > 0, "StakingRewardsProxy: Nothing to withdraw");

        actionInQueue[msg.sender] = ACTION_WITHDRAW;
        signatures[msg.sender] = _signature;
        uint256 amount = 0;
        emit WithdrawalInitiated(msg.sender);
        _sendMessage(ACTION_WITHDRAW, amount, _signature);
    }

    function claim(bytes memory _signature) external payable notPaused notInQueue(msg.sender) {
        actionInQueue[msg.sender] = ACTION_CLAIM;
        signatures[msg.sender] = _signature;
        uint256 amount = 0;
        emit ClaimInitiated(msg.sender);
        _sendMessage(ACTION_CLAIM, amount, _signature);
    }

    function _nonblockingLzReceive(
        uint16, /*_srcChainId*/
        bytes memory, /*_srcAddress*/
        uint64 _nonce,
        bytes memory _payload
    ) internal override notPaused {
        require(nonceRegistry[_nonce] == false, "This nonce was already processed");
        nonceRegistry[_nonce] = true;

        (address payable target, uint256 rewardAmount, uint256 withdrawAmount, bytes memory signature) = abi.decode(_payload, (address, uint256, uint256, bytes));

        require(actionInQueue[target] != bytes32(0x0), "StakingRewardsProxy: No claim or withdrawal is in queue for this address");
        require(keccak256(signatures[target]) == keccak256(signature), "StakingRewardsProxy: Invalid signature");

        if (withdrawAmount > 0) {
            require(balances[target] > 0, "StakingRewardsProxy: Invalid withdrawal, no deposits done");
            require(stakingToken.balanceOf(address(this)) >= withdrawAmount, "StakingRewardsProxy: Insufficient proxy token balance");

            stakingToken.transfer(target, withdrawAmount);
            balances[target] = balances[target] - withdrawAmount;
            emit Withdrawn(target, withdrawAmount);
        }

        if (rewardAmount > 0) {
            require(stakingToken.balanceOf(fund) >= rewardAmount, "StakingRewardsProxy: Insufficient fund token balance");

            stakingToken.safeTransferFrom(fund, target, rewardAmount);
            emit Claimed(target, rewardAmount);
        }

        delete actionInQueue[target];
        delete signatures[target];
    }

    function emergency() external onlyOwner {
        paused = 1;
    }

    function emergencyWithdraw() external {
        require(paused == 1, "StakingRewardsProxy: contract is not paused");
        require(balances[msg.sender] > 0, "StakingRewardsProxy: Invalid withdrawal, no deposits done");

        uint256 balance = balances[msg.sender];
        balances[msg.sender] = 0;
        stakingToken.transfer(msg.sender, balance);
        emit Withdrawn(msg.sender, balance);
    }

    function clearQueue(address _user) external onlyOwner {
        delete actionInQueue[_user];
        delete signatures[_user];
    }

    receive() external payable {}
}