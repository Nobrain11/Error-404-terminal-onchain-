// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ERROR404 FeeRouter
/// @notice Non-custodial wrapper: swap via Uniswap V3 SwapRouter02, take fee on OUTPUT,
///         enforce amountOutMinimum on what the user receives AFTER fees.
/// @dev NOT AUDITED. Order of operations is the security model:
///      1) feeBps capped
///      2) referrerBps capped by feeBps
///      3) min check after fee split
///      Change that order and you can build a drain.
///
/// Robinhood Chain (4663):
///   SwapRouter02 = 0xCaf681a66D020601342297493863E78C959E5cb2
///   WETH         = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract FeeRouter {
    uint24 public constant FEE_BPS_MAX = 100;
    uint24 public constant BPS = 10_000;

    uint24 public feeBps = 30;
    address public feeRecipient;
    address public owner;

    ISwapRouter02 public immutable swapRouter;
    IWETH public immutable WETH;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event FeeRecipientUpdated(address indexed previous, address indexed next);
    event FeeBpsUpdated(uint24 previous, uint24 next);
    event FeeCollected(
        address indexed tokenOut,
        uint256 protocolFee,
        uint256 referrerFee,
        address indexed referrer,
        uint24 referrerBps
    );
    event SwapExecuted(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOutNet
    );

    error ZeroAddress();
    error FeeTooHigh();
    error RefExceedsFee();
    error BadReferrer();
    error ZeroAmount();
    error MinNotMet();
    error TransferFailed();
    error ApproveFailed();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address swapRouter_, address weth_, address feeRecipient_) {
        if (swapRouter_ == address(0) || weth_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        swapRouter = ISwapRouter02(swapRouter_);
        WETH = IWETH(weth_);
        feeRecipient = feeRecipient_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeRecipientUpdated(address(0), feeRecipient_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeeRecipient(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, next);
        feeRecipient = next;
    }

    function setFeeBps(uint24 next) external onlyOwner {
        if (next > FEE_BPS_MAX) revert FeeTooHigh();
        emit FeeBpsUpdated(feeBps, next);
        feeBps = next;
    }

    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96,
        address referrer,
        uint24 referrerBps
    ) external returns (uint256 amountOutNet) {
        if (amountIn == 0) revert ZeroAmount();
        if (tokenIn == address(0) || tokenOut == address(0)) revert ZeroAddress();
        if (referrerBps > feeBps) revert RefExceedsFee();
        if (referrerBps > 0 && referrer == address(0)) revert BadReferrer();

        if (!_pull(tokenIn, msg.sender, address(this), amountIn)) revert TransferFailed();
        if (!_approve(tokenIn, address(swapRouter), amountIn)) revert ApproveFailed();

        uint256 grossMin = _grossMin(amountOutMinimum, feeBps);

        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: grossMin,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        amountOutNet = _splitAndPay(tokenOut, amountOut, amountOutMinimum, referrer, referrerBps);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOutNet);
    }

    function swapExactInputSingleETH(
        address tokenOut,
        uint24 poolFee,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96,
        address referrer,
        uint24 referrerBps
    ) external payable returns (uint256 amountOutNet) {
        if (msg.value == 0) revert ZeroAmount();
        if (tokenOut == address(0)) revert ZeroAddress();
        if (referrerBps > feeBps) revert RefExceedsFee();
        if (referrerBps > 0 && referrer == address(0)) revert BadReferrer();

        WETH.deposit{value: msg.value}();
        if (!_approve(address(WETH), address(swapRouter), msg.value)) revert ApproveFailed();

        uint256 grossMin = _grossMin(amountOutMinimum, feeBps);

        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(WETH),
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: address(this),
                amountIn: msg.value,
                amountOutMinimum: grossMin,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        amountOutNet = _splitAndPay(tokenOut, amountOut, amountOutMinimum, referrer, referrerBps);
        emit SwapExecuted(msg.sender, address(WETH), tokenOut, msg.value, amountOutNet);
    }

    function _splitAndPay(
        address tokenOut,
        uint256 amountOut,
        uint256 amountOutMinimum,
        address referrer,
        uint24 referrerBps
    ) internal returns (uint256 netOut) {
        uint256 totalFee = (amountOut * uint256(feeBps)) / uint256(BPS);
        uint256 referrerFee = 0;

        if (referrerBps > 0 && referrer != address(0) && totalFee > 0) {
            referrerFee = (totalFee * uint256(referrerBps)) / uint256(feeBps);
            if (referrerFee > 0) {
                if (!_push(tokenOut, referrer, referrerFee)) revert TransferFailed();
            }
        }

        uint256 protocolFee = totalFee - referrerFee;
        if (protocolFee > 0) {
            if (!_push(tokenOut, feeRecipient, protocolFee)) revert TransferFailed();
        }

        netOut = amountOut - totalFee;
        if (netOut < amountOutMinimum) revert MinNotMet();

        if (!_push(tokenOut, msg.sender, netOut)) revert TransferFailed();

        emit FeeCollected(tokenOut, protocolFee, referrerFee, referrer, referrerBps);
    }

    function _grossMin(uint256 amountOutMinimum, uint24 feeBps_) internal pure returns (uint256) {
        if (amountOutMinimum == 0) return 0;
        uint256 denom = uint256(BPS) - uint256(feeBps_);
        return (amountOutMinimum * uint256(BPS) + denom - 1) / denom;
    }

    function _pull(address token, address from, address to, uint256 amount) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _push(address token, address to, uint256 amount) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _approve(address token, address spender, uint256 amount) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    receive() external payable {}
}
