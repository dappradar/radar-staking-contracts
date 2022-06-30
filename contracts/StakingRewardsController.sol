// SPDX-License-Identifier: MIT licensed

pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IStakingRewardsController.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./LZ/LzApp.sol";
import "./LZ/NonBlockingLzApp.sol";

contract StakingRewardsController is NonblockingLzApp, IStakingRewardsController, ReentrancyGuard {
    using ERC165Checker for address;

    uint256 constant internal BASE_UNIT = 1e18;
    bytes32 constant internal ACTION_STAKE = "stake";
    bytes32 constant internal ACTION_WITHDRAW = "withdraw";
    bytes32 constant internal ACTION_CLAIM = "claim";
    bytes32 constant internal ACTION_TRANSFER = "transfer";

    uint256 public rewardPerSecond;
    uint256 public override totalSupply;
    mapping(uint16 => uint256) public supplyPerChain;

    struct GasAmounts {
        uint256 proxyWithdraw;
        uint256 proxyClaim;
    }

    struct PoolInfo {
        uint256 accToken1PerShare;
        uint256 lastRewardTime;
    }

    struct UserInfo {
        uint256 amount;
        mapping(uint16 => uint256) amountPerChain;
        uint256 rewardDebt;
        uint256 unpaidRewards;
    }

    PoolInfo public poolInfo;
    GasAmounts public gasAmounts;
    mapping (uint16 => mapping(uint64 => bool)) private nonceRegistry;

    mapping(address => UserInfo) public userInfo;

    /************** events ***************/
    event Staked(address indexed user, uint256 amount, uint16 indexed chainId);
    event Withdrawn(address indexed user, uint256 amount, uint16 indexed chainId);
    event Claimed(address indexed user, uint256 amount, uint16 indexed chainId);

    event LogOnReward(address indexed user, uint256 amount);
    event LogUpdatePool(uint256 lastRewardTime, uint256 totalSupply, uint256 accToken1PerShare);
    event LogRewardPerSecond(uint256 rewardPerSecond);

    constructor(
        address _owner,
        uint256 _rewardPerSecond,
        address _endpoint
    ) ReentrancyGuard() NonblockingLzApp(_endpoint) {
        transferOwnership(_owner);
        rewardPerSecond = _rewardPerSecond;

        gasAmounts.proxyWithdraw = 260000;
        gasAmounts.proxyClaim = 240000;
    }

    /************** views ***************/

    function balanceOf(address _user) external view override returns (uint256) {
        return userInfo[_user].amount;
    }

    function balanceOf(address _user, uint16 chainId) external view override returns (uint256) {
        return userInfo[_user].amountPerChain[chainId];
    }

    /// @notice View function to see pending rewards
    /// @param _user Address of user.
    /// @return pending token reward for a given user.
    function pendingRewards(address _user) public view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo;
        UserInfo storage user = userInfo[_user];
        uint256 accToken1PerShare = pool.accToken1PerShare;
        if (block.timestamp > pool.lastRewardTime && totalSupply != 0) {
            uint256 time = block.timestamp - pool.lastRewardTime;
            uint256 tokenReward = time * rewardPerSecond;
            accToken1PerShare = accToken1PerShare + (tokenReward * BASE_UNIT / totalSupply);
        }
        pending = (user.amount * accToken1PerShare / BASE_UNIT) - user.rewardDebt + user.unpaidRewards;
    }

    /************** mutative functions ***************/
    function _stake(address _user, uint256 _amount, uint16 _srcChainId) internal nonReentrant {
        require(_amount > 0, "RadarStakingRewards: cannot stake 0");
        updatePool();

        totalSupply += _amount;

        UserInfo storage user = userInfo[_user];
        user.amount += _amount;
        user.amountPerChain[_srcChainId] += _amount;
        user.rewardDebt = user.rewardDebt + (_amount * poolInfo.accToken1PerShare / BASE_UNIT);

        emit Staked(_user, _amount, _srcChainId);
    }

    function _withdraw(address _user, bytes memory _signature, uint16 _dstChain, address _dstAddress) internal nonReentrant {
        uint256 userBalance = userInfo[_user].amountPerChain[_dstChain];
        require(userBalance > 0, "RadarStakingRewards: this wallet has nothing staked on this chain");

        _getReward(_user, userBalance, _signature, _dstChain, _dstAddress);

        totalSupply -= userBalance;

        UserInfo storage user = userInfo[_user];
        user.amount -= userBalance;
        user.amountPerChain[_dstChain] = 0;

        emit Withdrawn(_user, userBalance, _dstChain);
    }

    function _claim(address _user, bytes memory _signature, uint16 _dstChain, address _dstAddress) internal nonReentrant {
        _getReward(_user, 0, _signature, _dstChain, _dstAddress);
    }

    function _getReward(address _user, uint256 _withdrawalAmount, bytes memory _signature, uint16 _dstChain, address _dstAddress) private {
        PoolInfo memory pool = updatePool();
        UserInfo storage user = userInfo[_user];
        uint256 rewardAmount;
        if (user.amount > 0) {
            rewardAmount = (user.amount * pool.accToken1PerShare / BASE_UNIT) - user.rewardDebt + user.unpaidRewards;
            user.unpaidRewards = 0;
        }

        user.rewardDebt = (userInfo[_user].amount - _withdrawalAmount) * pool.accToken1PerShare / BASE_UNIT;

        _sendMessage(_user, rewardAmount, _withdrawalAmount, _signature, _dstChain, _dstAddress);
        emit Claimed(_user, rewardAmount, _dstChain);
    }

    function getAdapterParams(bytes32 _action) internal view returns (bytes memory adapterParams) {
        uint16 version = 1;
        uint256 gasForDestinationLzReceive;
        if (_action == ACTION_CLAIM) {
            gasForDestinationLzReceive = gasAmounts.proxyClaim;
        } else if (_action == ACTION_WITHDRAW) {
            gasForDestinationLzReceive = gasAmounts.proxyWithdraw;
        }
        require(gasForDestinationLzReceive > 0, "StakingRewardsController: unable to estimate gas fee");

        adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);
    }

    function estimateFees(uint16 _dstChainId, address _dstAddress, bytes32 _action, uint256 _rewardAmount, uint256 _withdrawalAmount, bytes memory _signature) public view returns (uint256 messageFee){
        bytes memory adapterParams = getAdapterParams(_action);

        bytes memory payload = abi.encode(msg.sender, _rewardAmount, _withdrawalAmount, _signature);
        // get the fees we need to pay to LayerZero for message delivery
        (messageFee,) = lzEndpoint.estimateFees(_dstChainId, _dstAddress, payload, false, adapterParams);
    }

    function _sendMessage(address _user, uint256 _rewardAmount, uint256 _withdrawalAmount, bytes memory _signature, uint16 _dstChain, address _dstAddress) internal {
        require(address(this).balance > 0, "StakingRewardsController: address(this).balance is 0");

        bytes memory payload = abi.encode(_user, _rewardAmount, _withdrawalAmount, _signature);

        // use adapterParams v1 to specify more gas for the destination
        uint16 version = 1;
        uint256 gasForDestinationLzReceive;
        if (_withdrawalAmount > 0) {
            gasForDestinationLzReceive = gasAmounts.proxyWithdraw;
        } else {
            gasForDestinationLzReceive = gasAmounts.proxyClaim;
        }

        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);

        // get the fees we need to pay to LayerZero for message delivery
        (uint256 messageFee,) = lzEndpoint.estimateFees(_dstChain, _dstAddress, payload, false, adapterParams);

        require(address(this).balance >= messageFee, "StakingRewardsController: address(this).balance < messageFee");

        _lzSendWithCustomValue(// {value: messageFee} will be paid out of this contract!
            messageFee,
            _dstChain, // destination chainId
            payload, // abi.encode()'ed bytes
            payable(_user), // refund address (LayerZero will refund any extra gas)
            address(0x0), // future param, unused for this example
            adapterParams // v1 adapterParams, specify custom destination gas qty
        );
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal override {
        require(!nonceRegistry[_srcChainId][_nonce], "This nonce was already processed");
        nonceRegistry[_srcChainId][_nonce] = true;

        // use assembly to extract the address from the bytes memory parameter
        address sendBackToAddress;
        assembly {
            sendBackToAddress := mload(add(_srcAddress, 20))
        }

        (address user, bytes32 action, uint256 amount, bytes memory signature) = abi.decode(_payload, (address, bytes32, uint256, bytes));
        require(action == ACTION_STAKE || action == ACTION_WITHDRAW || action == ACTION_CLAIM, "StakingRewardsController: Invalid action");

        bytes32 amountHashed = keccak256(abi.encodePacked(stringToBytes32(Strings.toString(amount))));
        bytes32 hash = keccak256(abi.encodePacked(action, amountHashed));

        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(hash, signature);
        require(error == ECDSA.RecoverError.NoError && recovered == user, "StakingRewardsController: Invalid signature");

        if (action == ACTION_STAKE) {
            _stake(user, amount, _srcChainId);
        } else if (action == ACTION_WITHDRAW) {
            _withdraw(user, signature, _srcChainId, sendBackToAddress);
        } else if (action == ACTION_CLAIM) {
            _claim(user, signature, _srcChainId, sendBackToAddress);
        }
    }

    /// @notice Update reward variables of the given pool.
    /// @return pool Returns the pool that was updated.
    function updatePool() public returns (PoolInfo memory pool) {
        pool = poolInfo;
        if (block.timestamp > pool.lastRewardTime) {
            if (totalSupply > 0) {
                uint256 time = block.timestamp - pool.lastRewardTime;
                uint256 tokenReward = time * rewardPerSecond;
                pool.accToken1PerShare = pool.accToken1PerShare + (tokenReward * BASE_UNIT / totalSupply);
            }
            pool.lastRewardTime = block.timestamp;
            poolInfo = pool;
            emit LogUpdatePool(pool.lastRewardTime, totalSupply, pool.accToken1PerShare);
        }
    }

    /// @notice Sets the token per second to be distributed. Can only be called by the owner.
    /// @param _rewardPerSecond The amount of token to be distributed per second.
    function setRewardPerSecond(uint256 _rewardPerSecond) public onlyOwner {
        updatePool();
        rewardPerSecond = _rewardPerSecond;
        emit LogRewardPerSecond(_rewardPerSecond);
    }

    function setGasAmounts(uint256 _proxyWithdraw, uint256 _proxyClaim) public onlyOwner {
        if (_proxyWithdraw > 0) {
            gasAmounts.proxyWithdraw = _proxyWithdraw;
        }

        if (_proxyClaim > 0) {
            gasAmounts.proxyClaim = _proxyClaim;
        }
    }

    function stringToBytes32(string memory source) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success, "StakingRewardsController: unable to send value, recipient may have reverted");
    }

    receive() external payable {}
}
