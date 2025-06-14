// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPersonaTokenFactory {
    function personas(uint256 tokenId) external view returns (
        string memory name,
        string memory symbol,
        address erc20Token,
        address pairToken,
        address agentToken,
        bool pairCreated,
        uint256 createdAt,
        uint256 totalAgentDeposited
    );
}

/**
 * @title PersonaStakingRewards
 * @notice MasterChef-style contract for rewarding LP providers with AMICA tokens
 * @dev Supports both Persona/PairingToken LPs and Persona/AgentToken LPs
 */
contract PersonaStakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct PoolInfo {
        IERC20 lpToken;           // LP token address
        uint256 allocPoint;       // Allocation points for this pool
        uint256 lastRewardBlock;  // Last block number that rewards were calculated
        uint256 accAmicaPerShare; // Accumulated AMICA per share, times 1e12
        uint256 totalStaked;      // Total LP tokens staked
        bool isAgentPool;         // True if this is a Persona/Agent pool
        uint256 personaTokenId;   // Associated persona token ID
    }

    struct UserInfo {
        uint256 amount;           // LP tokens staked by user
        uint256 rewardDebt;       // Reward debt
        uint256 pendingRewards;   // Pending rewards to claim
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    IERC20 public immutable amicaToken;
    IPersonaTokenFactory public immutable personaFactory;

    uint256 public amicaPerBlock;        // AMICA tokens distributed per block
    uint256 public totalAllocPoint;      // Total allocation points
    uint256 public startBlock;           // Start block for rewards
    uint256 public endBlock;             // End block for rewards (0 = no end)

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;  // poolId => user => info
    mapping(address => uint256) public lpTokenToPoolId;                // LP token => poolId

    // Boost multipliers for agent token pools
    uint256 public constant AGENT_POOL_BOOST = 150;  // 1.5x boost for agent pools
    uint256 public constant BASIS_POINTS = 100;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PoolAdded(uint256 indexed poolId, address indexed lpToken, uint256 allocPoint, bool isAgentPool);
    event PoolUpdated(uint256 indexed poolId, uint256 allocPoint);
    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);
    event Claim(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardRateUpdated(uint256 amicaPerBlock);
    event RewardPeriodUpdated(uint256 startBlock, uint256 endBlock);

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor(
        address _amicaToken,
        address _personaFactory,
        uint256 _amicaPerBlock,
        uint256 _startBlock
    ) Ownable(msg.sender) {
        amicaToken = IERC20(_amicaToken);
        personaFactory = IPersonaTokenFactory(_personaFactory);
        amicaPerBlock = _amicaPerBlock;
        startBlock = _startBlock;
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Add a new LP pool
     * @param _lpToken LP token address
     * @param _allocPoint Allocation points for this pool
     * @param _isAgentPool True if this is a Persona/Agent pool
     * @param _personaTokenId Associated persona token ID
     */
    function addPool(
        address _lpToken,
        uint256 _allocPoint,
        bool _isAgentPool,
        uint256 _personaTokenId
    ) external onlyOwner {
        require(_lpToken != address(0), "Invalid LP token");
        require(lpTokenToPoolId[_lpToken] == 0, "Pool already exists");

        massUpdatePools();

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint += _allocPoint;

        poolInfo.push(PoolInfo({
            lpToken: IERC20(_lpToken),
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accAmicaPerShare: 0,
            totalStaked: 0,
            isAgentPool: _isAgentPool,
            personaTokenId: _personaTokenId
        }));

        uint256 poolId = poolInfo.length - 1;
        lpTokenToPoolId[_lpToken] = poolId + 1; // Store poolId + 1 to distinguish from default 0

        emit PoolAdded(poolId, _lpToken, _allocPoint, _isAgentPool);
    }

    /**
     * @notice Update allocation points for a pool
     */
    function updatePool(uint256 _poolId, uint256 _allocPoint) external onlyOwner {
        require(_poolId < poolInfo.length, "Invalid pool");

        massUpdatePools();

        totalAllocPoint = totalAllocPoint - poolInfo[_poolId].allocPoint + _allocPoint;
        poolInfo[_poolId].allocPoint = _allocPoint;

        emit PoolUpdated(_poolId, _allocPoint);
    }

    /**
     * @notice Update reward rate
     */
    function updateRewardRate(uint256 _amicaPerBlock) external onlyOwner {
        massUpdatePools();
        amicaPerBlock = _amicaPerBlock;
        emit RewardRateUpdated(_amicaPerBlock);
    }

    /**
     * @notice Update reward period
     */
    function updateRewardPeriod(uint256 _startBlock, uint256 _endBlock) external onlyOwner {
        require(_endBlock == 0 || _endBlock > _startBlock, "Invalid period");
        massUpdatePools();
        startBlock = _startBlock;
        endBlock = _endBlock;
        emit RewardPeriodUpdated(_startBlock, _endBlock);
    }

    /**
     * @notice Emergency withdraw stuck tokens (not user deposits)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");

        // Prevent withdrawing LP tokens that users have deposited
        for (uint256 i = 0; i < poolInfo.length; i++) {
            require(token != address(poolInfo[i].lpToken), "Cannot withdraw LP tokens");
        }

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    // ============================================================================
    // PUBLIC FUNCTIONS
    // ============================================================================

    /**
     * @notice Update all pools
     */
    function massUpdatePools() public {
        for (uint256 poolId = 0; poolId < poolInfo.length; poolId++) {
            updatePoolRewards(poolId);
        }
    }

    /**
     * @notice Update rewards for a specific pool
     */
    function updatePoolRewards(uint256 _poolId) public {
        PoolInfo storage pool = poolInfo[_poolId];

        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        if (pool.totalStaked == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 amicaReward = (multiplier * amicaPerBlock * pool.allocPoint) / totalAllocPoint;

        // Apply boost for agent pools
        if (pool.isAgentPool) {
            amicaReward = (amicaReward * AGENT_POOL_BOOST) / BASIS_POINTS;
        }

        pool.accAmicaPerShare += (amicaReward * 1e12) / pool.totalStaked;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @notice Stake LP tokens
     */
    function stake(uint256 _poolId, uint256 _amount) external nonReentrant {
        require(_poolId < poolInfo.length, "Invalid pool");
        require(_amount > 0, "Cannot stake 0");

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        updatePoolRewards(_poolId);

        // Calculate pending rewards
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accAmicaPerShare) / 1e12 - user.rewardDebt;
            if (pending > 0) {
                user.pendingRewards += pending;
            }
        }

        // Transfer LP tokens from user
        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Update user info
        user.amount += _amount;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / 1e12;

        // Update pool info
        pool.totalStaked += _amount;

        emit Deposit(msg.sender, _poolId, _amount);
    }

    /**
     * @notice Withdraw LP tokens
     */
    function withdraw(uint256 _poolId, uint256 _amount) external nonReentrant {
        require(_poolId < poolInfo.length, "Invalid pool");

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        require(user.amount >= _amount, "Insufficient balance");

        updatePoolRewards(_poolId);

        // Calculate pending rewards
        uint256 pending = (user.amount * pool.accAmicaPerShare) / 1e12 - user.rewardDebt;
        if (pending > 0) {
            user.pendingRewards += pending;
        }

        // Update user info
        user.amount -= _amount;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / 1e12;

        // Update pool info
        pool.totalStaked -= _amount;

        // Transfer LP tokens back to user
        pool.lpToken.safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _poolId, _amount);
    }

    /**
     * @notice Claim pending rewards
     */
    function claim(uint256 _poolId) external nonReentrant {
        require(_poolId < poolInfo.length, "Invalid pool");

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        updatePoolRewards(_poolId);

        // Calculate total pending
        uint256 pending = user.pendingRewards;
        if (user.amount > 0) {
            pending += (user.amount * pool.accAmicaPerShare) / 1e12 - user.rewardDebt;
        }

        require(pending > 0, "No rewards to claim");

        // Reset pending rewards and update debt
        user.pendingRewards = 0;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / 1e12;

        // Transfer rewards
        amicaToken.safeTransfer(msg.sender, pending);

        emit Claim(msg.sender, _poolId, pending);
    }

    /**
     * @notice Claim rewards from multiple pools
     */
    function claimAll(uint256[] calldata _poolIds) external nonReentrant {
        uint256 totalPending = 0;

        for (uint256 i = 0; i < _poolIds.length; i++) {
            uint256 poolId = _poolIds[i];
            require(poolId < poolInfo.length, "Invalid pool");

            PoolInfo storage pool = poolInfo[poolId];
            UserInfo storage user = userInfo[poolId][msg.sender];

            updatePoolRewards(poolId);

            // Calculate pending for this pool
            uint256 pending = user.pendingRewards;
            if (user.amount > 0) {
                pending += (user.amount * pool.accAmicaPerShare) / 1e12 - user.rewardDebt;
            }

            if (pending > 0) {
                totalPending += pending;
                user.pendingRewards = 0;
                user.rewardDebt = (user.amount * pool.accAmicaPerShare) / 1e12;
                emit Claim(msg.sender, poolId, pending);
            }
        }

        require(totalPending > 0, "No rewards to claim");
        amicaToken.safeTransfer(msg.sender, totalPending);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get number of pools
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Calculate pending rewards for a user
     */
    function pendingRewards(uint256 _poolId, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][_user];

        uint256 accAmicaPerShare = pool.accAmicaPerShare;

        if (block.number > pool.lastRewardBlock && pool.totalStaked > 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 amicaReward = (multiplier * amicaPerBlock * pool.allocPoint) / totalAllocPoint;

            if (pool.isAgentPool) {
                amicaReward = (amicaReward * AGENT_POOL_BOOST) / BASIS_POINTS;
            }

            accAmicaPerShare += (amicaReward * 1e12) / pool.totalStaked;
        }

        uint256 pending = user.pendingRewards;
        if (user.amount > 0) {
            pending += (user.amount * accAmicaPerShare) / 1e12 - user.rewardDebt;
        }

        return pending;
    }

    /**
     * @notice Get reward multiplier between two blocks
     */
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (endBlock > 0) {
            if (_to <= endBlock) {
                return _to - _from;
            } else if (_from >= endBlock) {
                return 0;
            } else {
                return endBlock - _from;
            }
        }
        return _to - _from;
    }

    /**
     * @notice Get pool ID by LP token address
     */
    function getPoolIdByLpToken(address _lpToken) external view returns (uint256) {
        uint256 storedValue = lpTokenToPoolId[_lpToken];
        require(storedValue > 0, "Pool not found");
        return storedValue - 1;
    }

    /**
     * @notice Get all user stakes across pools
     */
    function getUserStakes(address _user) external view returns (
        uint256[] memory poolIds,
        uint256[] memory amounts,
        uint256[] memory pendingAmounts
    ) {
        uint256 activeCount = 0;

        // Count active stakes
        for (uint256 i = 0; i < poolInfo.length; i++) {
            if (userInfo[i][_user].amount > 0 || userInfo[i][_user].pendingRewards > 0) {
                activeCount++;
            }
        }

        // Populate arrays
        poolIds = new uint256[](activeCount);
        amounts = new uint256[](activeCount);
        pendingAmounts = new uint256[](activeCount);

        uint256 index = 0;
        for (uint256 i = 0; i < poolInfo.length; i++) {
            UserInfo storage user = userInfo[i][_user];
            if (user.amount > 0 || user.pendingRewards > 0) {
                poolIds[index] = i;
                amounts[index] = user.amount;
                pendingAmounts[index] = this.pendingRewards(i, _user);
                index++;
            }
        }
    }
}
