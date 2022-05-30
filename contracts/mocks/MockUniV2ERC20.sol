pragma solidity 0.8.4;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract MockUniV2ERC20 is IUniswapV2ERC20 {
    using SafeMath for uint;

    uint  public _totalSupply;
    mapping(address => uint) public _balanceOf;
    mapping(address => mapping(address => uint)) public _allowance;

    bytes32 public _DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint)  public _nonces;

    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);

        uint chainId;
        assembly {
            chainId := chainid()
        }
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes('Uniswap V2')),
                keccak256(bytes('1')),
                chainId,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() external override view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function PERMIT_TYPEHASH() external override pure returns (bytes32) {
        return _PERMIT_TYPEHASH;
    }

    function name() public override pure returns (string memory) {
        return 'Uniswap V2';
    }

    function symbol() public override pure returns (string memory) {
        return 'UNI-V2';
    }

    function decimals() public override pure returns (uint8) {
        return 18;
    }

    function totalSupply() external override view returns (uint) {
        return _totalSupply;
    }

    function nonces(address owner) external override view returns (uint) {
        return _nonces[owner];
    }

    function balanceOf(address owner) external override view returns (uint) {
        return _balanceOf[owner];
    }

    function allowance(address owner, address spender) external override view returns (uint) {
        return _allowance[owner][spender];
    }


    function _mint(address to, uint value) internal {
        _totalSupply = _totalSupply.add(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint value) internal {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _totalSupply = _totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    function _approve(address owner, address spender, uint value) private {
        _allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(address from, address to, uint value) private {
        _balanceOf[from] = _balanceOf[from].sub(value);
        _balanceOf[to] = _balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    function approve(address spender, uint value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value) external override returns (bool) {
        if (_allowance[from][msg.sender] != type(uint256).max) {
            _allowance[from][msg.sender] = _allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) override external {
        require(deadline >= block.timestamp, 'UniswapV2: EXPIRED');
        uint nonce = _nonces[owner]++;

        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                _DOMAIN_SEPARATOR,
                keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, nonce, deadline))
            )
        );

        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'UniswapV2: INVALID_SIGNATURE');
        _approve(owner, spender, value);
    }
}
