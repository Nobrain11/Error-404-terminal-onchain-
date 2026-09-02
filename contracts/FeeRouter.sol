// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ERROR404 FeeRouter — thin non-custodial wrapper around Uniswap V3 SwapRouter02
/// @notice Takes FEE_BPS (0.3%) of native ETH on buys; on sells takes FEE_BPS of token in before swap.
///         Keys never held. No upgradeability. No admin withdrawal of user funds (only fee recipient gets fees).

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
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract FeeRouter {
    uint256 public constant FEE_BPS = 30; // 0.3%
    uint256 public constant BPS = 10_000;

    ISwapRouter02 public immutable swapRouter;
    address public immutable WETH;
    address public immutable feeRecipient;

    event Buy(address indexed trader, address indexed tokenOut, uint256 amountIn, uint256 fee, uint256 amountOut);
    event Sell(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 fee, uint256 amountOut);

    error ZeroAddress();
    error ZeroValue();
    error TransferFailed();
    error ApproveFailed();

    constructor(address swapRouter_, address weth_, address feeRecipient_) {
        if (swapRouter_ == address(0) || weth_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        swapRouter = ISwapRouter02(swapRouter_);
        WETH = weth_;
        feeRecipient = feeRecipient_;
    }

    /// @notice Buy token with native ETH. Fee skimmed from msg.value; rest swapped WETH→tokenOut.
    function buyExactIn(
        address tokenOut,
        uint24 poolFee,
        uint256 amountOutMinimum
    ) external payable returns (uint256 amountOut) {
        if (msg.value == 0) revert ZeroValue();
        if (tokenOut == address(0)) revert ZeroAddress();

        uint256 fee = (msg.value * FEE_BPS) / BPS;
        uint256 toSwap = msg.value - fee;

        (bool ok, ) = feeRecipient.call{value: fee}("");
        if (!ok) revert TransferFailed();

        amountOut = swapRouter.exactInputSingle{value: toSwap}(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                amountIn: toSwap,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );

        emit Buy(msg.sender, tokenOut, msg.value, fee, amountOut);
    }

    /// @notice Sell token for WETH to msg.sender. Pulls token, skims fee, swaps rest.
    /// @dev Caller must approve this contract for amountIn.
    function sellExactIn(
        address tokenIn,
        uint24 poolFee,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroValue();
        if (tokenIn == address(0)) revert ZeroAddress();

        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) {
            revert TransferFailed();
        }

        uint256 fee = (amountIn * FEE_BPS) / BPS;
        uint256 toSwap = amountIn - fee;

        if (!IERC20(tokenIn).transfer(feeRecipient, fee)) revert TransferFailed();
        if (!IERC20(tokenIn).approve(address(swapRouter), toSwap)) revert ApproveFailed();

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: WETH,
                fee: poolFee,
                recipient: msg.sender,
                amountIn: toSwap,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );

        emit Sell(msg.sender, tokenIn, amountIn, fee, amountOut);
    }

    receive() external payable {}
}
