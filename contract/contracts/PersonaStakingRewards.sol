// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPersonaTokenFactory
 * @notice Interface for interacting with the Persona Token Factory
 */
interface IPersonaTokenFactory {
    /**
     * @notice Get persona information by token ID
     * @param tokenId The ID of the persona token
     * @return name The name of the persona
     * @return symbol The symbol of the persona
     * @return erc20Token The ERC20 token address
     * @return pairToken The pair token address
     * @return agentToken The agent token address
     * @return pairCreated Whether the pair has been created
     * @return createdAt The creation timestamp
     * @return totalAgentDeposited The total amount of agent tokens deposited
     */
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

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

error InvalidLPToken();
error PoolAlreadyExists();
error TotalAllocationExceeds100();
error InvalidPool();
error InvalidMultiplier();
error InvalidDuration();
error InvalidIndex();
error AmountCannotBeZero();
error PoolNotActive();
error InsufficientBalance();
error InvalidLockTier();
error StillLocked();
error LockNotFound();
error AlreadyWithdrawn();
error NothingToWithdraw();
error NoRewardsToClaim();
error InvalidToken();
error CannotWithdrawLPTokens();
error InvalidPeriod();
error PoolNotFound();


/**
 * @title PersonaStakingRewards
 * @author Kasumi
 * @notice A gas-optimized staking contract with time-locked bonus multipliers for LP tokens
 * @dev Implements flexible staking and time-locked staking with configurable multipliers.
 * Users can stake LP tokens in multiple pools and earn AMICA rewards proportional to their
 * stake and lock duration. The contract supports both regular LP pools and special Persona/Agent pools.
 */
contract PersonaStakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /**
     * @notice Information about a staking pool
     * @param lpToken The LP token that can be staked in this pool
     * @param allocBasisPoints Allocation points in basis points (100 = 1%)
     * @param lastRewardBlock Last block number when rewards were calculated
     * @param accAmicaPerShare Accumulated AMICA per share, multiplied by 1e18
     * @param totalStaked Total amount of LP tokens staked in the pool
     * @param isAgentPool Whether this is a Persona/Agent pool
     * @param personaTokenId The associated persona token ID (if applicable)
     * @param isActive Whether the pool is currently active
     */
    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocBasisPoints;
        uint256 lastRewardBlock;
        uint256 accAmicaPerShare;
        uint256 totalStaked;
        bool isAgentPool;
        uint256 personaTokenId;
        bool isActive;
    }

    /**
     * @notice Information about a user's stake in a pool
     * @param amount Amount of LP tokens staked (flexible stake)
     * @param rewardDebt Reward debt for flexible stake
     * @param unclaimedRewards Accumulated unclaimed rewards
     * @param lastClaimBlock Last block when user claimed rewards
     */
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 unclaimedRewards;
        uint256 lastClaimBlock;
    }

    /**
     * @notice Information about a locked stake
     * @param amount Amount of tokens locked
     * @param unlockTime Timestamp when tokens can be withdrawn
     * @param lockMultiplier Reward multiplier in basis points (10000 = 1x)
     * @param rewardDebt Reward debt for this specific lock
     * @param lockId Unique identifier for this lock
     */
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
        uint256 lockMultiplier;
        uint256 rewardDebt;
        uint256 lockId;
    }

    /**
     * @notice Lock tier configuration
     * @param duration Lock duration in seconds
     * @param multiplier Reward multiplier in basis points
     */
    struct LockTier {
        uint256 duration;
        uint256 multiplier;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice AMICA token used for rewards
    IERC20 public immutable amicaToken;

    /// @notice Persona token factory contract
    IPersonaTokenFactory public immutable personaFactory;

    /// @notice Amount of AMICA tokens distributed per block
    uint256 public amicaPerBlock;

    /// @notice Sum of all pool allocation basis points (max 10000)
    uint256 public totalAllocBasisPoints;

    /// @notice Block number when reward distribution starts
    uint256 public startBlock;

    /// @notice Block number when reward distribution ends (0 = no end)
    uint256 public endBlock;

    /// @notice Last block when mass update was called
    uint256 public lastMassUpdateBlock;

    /// @notice Array of all pools
    PoolInfo[] public poolInfo;

    /// @notice Mapping of pool ID => user address => user info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    /// @notice Mapping of LP token address => pool ID + 1 (0 means not found)
    mapping(address => uint256) public lpTokenToPoolId;

    /// @notice Mapping of pool ID => user address => array of locks
    mapping(uint256 => mapping(address => LockInfo[])) public userLocks;

    /// @notice Mapping of pool ID => user address => total locked amount
    mapping(uint256 => mapping(address => uint256)) public userLockedAmount;

    /// @notice Mapping of pool ID => user address => weighted amount (amount * multiplier)
    mapping(uint256 => mapping(address => uint256)) public userWeightedAmount;

    /// @notice Mapping of pool ID => total weighted stake in pool
    mapping(uint256 => uint256) public poolWeightedTotal;

    /// @notice Array of available lock tiers
    LockTier[] public lockTiers;

    /// @notice Counter for generating unique lock IDs
    uint256 public nextLockId = 1;

    /// @notice Mapping of user address => array of pool IDs where user has stake
    mapping(address => uint256[]) public userActivePools;

    /// @notice Mapping of user address => pool ID => whether user has stake
    mapping(address => mapping(uint256 => bool)) public userHasStake;

    /// @notice Mapping of user address => cached total pending rewards
    mapping(address => uint256) public userTotalPendingRewards;

    /// @notice Mapping of user address => last block when global state was updated
    mapping(address => uint256) public userLastGlobalUpdate;

    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Precision factor for reward calculations
    uint256 public constant PRECISION = 1e18;

    /// @notice Maximum allowed lock multiplier (5x = 50000 basis points)
    uint256 public constant MAX_LOCK_MULTIPLIER = 50000;

    // ============================================================================
    // EVENTS
    // ============================================================================

    /**
     * @notice Emitted when a new pool is added
     * @param poolId The ID of the new pool
     * @param lpToken The LP token address
     * @param allocBasisPoints The allocation in basis points
     * @param isAgentPool Whether this is a Persona/Agent pool
     */
    event PoolAdded(uint256 indexed poolId, address indexed lpToken, uint256 allocBasisPoints, bool isAgentPool);

    /**
     * @notice Emitted when a pool is updated
     * @param poolId The ID of the updated pool
     * @param allocBasisPoints The new allocation in basis points
     * @param isActive The new active status
     */
    event PoolUpdated(uint256 indexed poolId, uint256 allocBasisPoints, bool isActive);

    /**
     * @notice Emitted when a pool is deactivated
     * @param poolId The ID of the deactivated pool
     * @param timestamp The timestamp of deactivation
     */
    event PoolDeactivated(uint256 indexed poolId, uint256 timestamp);

    /**
     * @notice Emitted when a user deposits tokens
     * @param user The user address
     * @param poolId The pool ID
     * @param amount The amount deposited
     */
    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);

    /**
     * @notice Emitted when a user deposits with lock
     * @param user The user address
     * @param poolId The pool ID
     * @param amount The amount deposited
     * @param lockId The unique lock ID
     * @param unlockTime The unlock timestamp
     * @param multiplier The reward multiplier
     */
    event DepositLocked(address indexed user, uint256 indexed poolId, uint256 amount, uint256 lockId, uint256 unlockTime, uint256 multiplier);

    /**
     * @notice Emitted when a user withdraws tokens
     * @param user The user address
     * @param poolId The pool ID
     * @param amount The amount withdrawn
     */
    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);

    /**
     * @notice Emitted when a user withdraws locked tokens
     * @param user The user address
     * @param poolId The pool ID
     * @param lockId The lock ID
     * @param amount The amount withdrawn
     */
    event WithdrawLocked(address indexed user, uint256 indexed poolId, uint256 lockId, uint256 amount);

    /**
     * @notice Emitted when rewards are claimed
     * @param user The user address
     * @param amount The amount of rewards claimed
     */
    event RewardsClaimed(address indexed user, uint256 amount);

    /**
     * @notice Emitted when reward rate is updated
     * @param amicaPerBlock The new reward rate
     */
    event RewardRateUpdated(uint256 amicaPerBlock);

    /**
     * @notice Emitted when reward period is updated
     * @param startBlock The new start block
     * @param endBlock The new end block
     */
    event RewardPeriodUpdated(uint256 startBlock, uint256 endBlock);

    /**
     * @notice Emitted when a lock tier is added
     * @param duration The lock duration
     * @param multiplier The reward multiplier
     */
    event LockTierAdded(uint256 duration, uint256 multiplier);

    /**
     * @notice Emitted when a lock tier is updated
     * @param index The tier index
     * @param duration The new duration
     * @param multiplier The new multiplier
     */
    event LockTierUpdated(uint256 index, uint256 duration, uint256 multiplier);

    /**
     * @notice Emitted when a user emergency exits
     * @param user The user address
     * @param poolId The pool ID
     * @param amount The amount withdrawn
     */
    event EmergencyExit(address indexed user, uint256 indexed poolId, uint256 amount);

    /**
     * @notice Emitted when owner withdraws stuck tokens
     * @param user The recipient address
     * @param token The token address
     * @param amount The amount withdrawn
     */
    event EmergencyWithdrawCompleted(address indexed user, address indexed token, uint256 amount);

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Contract constructor
     * @param _amicaToken Address of the AMICA token
     * @param _personaFactory Address of the Persona token factory
     * @param _amicaPerBlock Initial reward rate per block
     * @param _startBlock Block number to start reward distribution
     */
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
        lastMassUpdateBlock = _startBlock;

        // Initialize default lock tiers
        lockTiers.push(LockTier(30 days, 12500));    // 1 month = 1.25x
        lockTiers.push(LockTier(90 days, 15000));    // 3 months = 1.5x
        lockTiers.push(LockTier(180 days, 20000));   // 6 months = 2x
        lockTiers.push(LockTier(365 days, 25000));   // 1 year = 2.5x
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Add a new LP pool for staking
     * @dev Only callable by owner. Reverts if pool already exists or allocation exceeds 100%
     * @param _lpToken Address of the LP token
     * @param _allocBasisPoints Allocation points in basis points (100 = 1%)
     * @param _isAgentPool Whether this is a Persona/Agent pool
     * @param _personaTokenId Associated persona token ID (if applicable)
     */
    function addPool(
        address _lpToken,
        uint256 _allocBasisPoints,
        bool _isAgentPool,
        uint256 _personaTokenId
    ) external onlyOwner {
        if (_lpToken == address(0)) revert InvalidLPToken();
        if (lpTokenToPoolId[_lpToken] != 0) revert PoolAlreadyExists();
        if (totalAllocBasisPoints + _allocBasisPoints > BASIS_POINTS) revert TotalAllocationExceeds100();

        _updateGlobalRewards();

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocBasisPoints += _allocBasisPoints;

        poolInfo.push(PoolInfo({
            lpToken: IERC20(_lpToken),
            allocBasisPoints: _allocBasisPoints,
            lastRewardBlock: lastRewardBlock,
            accAmicaPerShare: 0,
            totalStaked: 0,
            isAgentPool: _isAgentPool,
            personaTokenId: _personaTokenId,
            isActive: true
        }));

        uint256 poolId = poolInfo.length - 1;
        lpTokenToPoolId[_lpToken] = poolId + 1;

        emit PoolAdded(poolId, _lpToken, _allocBasisPoints, _isAgentPool);
    }

    /**
     * @notice Add or update a lock tier
     * @dev Only callable by owner. Updates existing tier or adds new one
     * @param index Index of the tier to update (use current length to add new)
     * @param duration Lock duration in seconds
     * @param multiplier Reward multiplier in basis points (10000 = 1x)
     */
    function setLockTier(uint256 index, uint256 duration, uint256 multiplier) external onlyOwner {
        if (multiplier < BASIS_POINTS || multiplier > MAX_LOCK_MULTIPLIER) revert InvalidMultiplier();
        if (duration == 0) revert InvalidDuration();

        if (index < lockTiers.length) {
            lockTiers[index] = LockTier(duration, multiplier);
            emit LockTierUpdated(index, duration, multiplier);
        } else {
            if (index != lockTiers.length) revert InvalidIndex();
            lockTiers.push(LockTier(duration, multiplier));
            emit LockTierAdded(duration, multiplier);
        }
    }

    /**
     * @notice Update pool allocation or active status
     * @dev Only callable by owner. Updates rewards before changing allocation
     * @param _poolId ID of the pool to update
     * @param _allocBasisPoints New allocation in basis points
     * @param _isActive New active status
     */
    function updatePool(
        uint256 _poolId,
        uint256 _allocBasisPoints,
        bool _isActive
    ) external onlyOwner {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        updatePoolRewards(_poolId);

        PoolInfo storage pool = poolInfo[_poolId];

        // Calculate new total allocation
        uint256 newTotalAlloc = totalAllocBasisPoints - pool.allocBasisPoints + _allocBasisPoints;
        if (newTotalAlloc > BASIS_POINTS) revert TotalAllocationExceeds100();

        totalAllocBasisPoints = newTotalAlloc;
        pool.allocBasisPoints = _allocBasisPoints;
        pool.isActive = _isActive;

        emit PoolUpdated(_poolId, _allocBasisPoints, _isActive);
    }

    /**
     * @notice Update the reward rate
     * @dev Only callable by owner. Updates all pool rewards before changing rate
     * @param _amicaPerBlock New reward rate per block
     */
    function updateRewardRate(uint256 _amicaPerBlock) external onlyOwner {
        _updateGlobalRewards();
        amicaPerBlock = _amicaPerBlock;
        emit RewardRateUpdated(_amicaPerBlock);
    }

    /**
     * @notice Update the reward distribution period
     * @dev Only callable by owner. End block must be after start block or 0
     * @param _startBlock New start block
     * @param _endBlock New end block (0 = no end)
     */
    function updateRewardPeriod(uint256 _startBlock, uint256 _endBlock) external onlyOwner {
        if (_endBlock != 0 && _endBlock <= _startBlock) revert InvalidPeriod();
        _updateGlobalRewards();
        startBlock = _startBlock;
        endBlock = _endBlock;
        emit RewardPeriodUpdated(_startBlock, _endBlock);
    }

    /**
     * @notice Emergency withdraw stuck tokens (not LP tokens)
     * @dev Only callable by owner. Cannot withdraw LP tokens that are staked
     * @param _token Address of the token to withdraw
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) revert InvalidToken();

        // Check if token is an LP token in any pool
        for (uint256 i = 0; i < poolInfo.length; i++) {
            if (address(poolInfo[i].lpToken) == _token) revert CannotWithdrawLPTokens();
        }

        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit EmergencyWithdrawCompleted(msg.sender, _token, _amount);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Update rewards for all active pools
     * @dev Called before any operation that changes reward distribution
     */
    function _updateGlobalRewards() internal {
        if (block.number <= lastMassUpdateBlock) return;

        uint256 poolCount = poolInfo.length;
        for (uint256 i = 0; i < poolCount; i++) {
            if (poolInfo[i].isActive) {
                updatePoolRewards(i);
            }
        }

        lastMassUpdateBlock = block.number;
    }

    /**
     * @notice Track user's participation in a pool
     * @dev Adds pool to user's active pools list if not already present
     * @param user User address
     * @param poolId Pool ID
     */
    function _addUserToPool(address user, uint256 poolId) internal {
        if (!userHasStake[user][poolId]) {
            userHasStake[user][poolId] = true;
            userActivePools[user].push(poolId);
        }
    }

    /**
     * @notice Remove user from pool tracking
     * @dev Removes pool from user's active pools list
     * @param user User address
     * @param poolId Pool ID
     */
    function _removeUserFromPool(address user, uint256 poolId) internal {
        if (userHasStake[user][poolId]) {
            userHasStake[user][poolId] = false;

            uint256[] storage activePools = userActivePools[user];
            uint256 length = activePools.length;
            for (uint256 i = 0; i < length; i++) {
                if (activePools[i] == poolId) {
                    activePools[i] = activePools[length - 1];
                    activePools.pop();
                    break;
                }
            }
        }
    }

    /**
     * @notice Calculate user's pending rewards for a pool
     * @dev Includes rewards from flexible stake and all locks
     * @param poolId The pool ID
     * @param user The user address
     * @return totalRewards Total pending rewards
     */
    function _calculateUserRewards(uint256 poolId, address user) internal view returns (uint256) {
        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage userStake = userInfo[poolId][user];

        // Cache storage values
        uint256 accAmicaPerShare = pool.accAmicaPerShare;
        uint256 userAmount = userStake.amount;
        uint256 userUnclaimedRewards = userStake.unclaimedRewards;
        uint256 userRewardDebt = userStake.rewardDebt;

        // Calculate updated accAmicaPerShare if needed
        if (block.number > pool.lastRewardBlock && poolWeightedTotal[poolId] > 0 && pool.isActive) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 amicaReward = (multiplier * amicaPerBlock * pool.allocBasisPoints) / BASIS_POINTS;
            accAmicaPerShare += (amicaReward * PRECISION) / poolWeightedTotal[poolId];
        }

        // Calculate rewards for flexible stake
        uint256 totalRewards = userUnclaimedRewards;
        if (userAmount > 0) {
            totalRewards += (userAmount * accAmicaPerShare) / PRECISION - userRewardDebt;
        }

        // Calculate rewards for each lock
        LockInfo[] storage locks = userLocks[poolId][user];
        uint256 locksLength = locks.length; // Cache array length

        for (uint256 i = 0; i < locksLength; i++) {
            LockInfo storage lock = locks[i]; // Cache storage pointer
            uint256 lockAmount = lock.amount; // Cache storage read

            if (lockAmount > 0) {
                uint256 weightedAmount = (lockAmount * lock.lockMultiplier) / BASIS_POINTS;
                totalRewards += (weightedAmount * accAmicaPerShare) / PRECISION - lock.rewardDebt;
            }
        }

        return totalRewards;
    }

    // ============================================================================
    // PUBLIC FUNCTIONS
    // ============================================================================

    /**
     * @notice Update rewards for a specific pool
     * @dev Can be called by anyone to update pool state
     * @param _poolId The pool ID to update
     */
    function updatePoolRewards(uint256 _poolId) public {
        PoolInfo storage pool = poolInfo[_poolId];

        // Cache storage values in memory
        uint256 lastRewardBlock = pool.lastRewardBlock;
        bool isActive = pool.isActive;

        if (block.number <= lastRewardBlock || !isActive) {
            return;
        }

        uint256 weightedTotal = poolWeightedTotal[_poolId];
        if (weightedTotal == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(lastRewardBlock, block.number);
        uint256 allocBasisPoints = pool.allocBasisPoints; // Cache storage read
        uint256 amicaReward = (multiplier * amicaPerBlock * allocBasisPoints) / BASIS_POINTS;

        pool.accAmicaPerShare += (amicaReward * PRECISION) / weightedTotal;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @notice Stake LP tokens without lock (flexible staking)
     * @dev Transfers LP tokens from user and updates their stake
     * @param _poolId Pool ID to stake in
     * @param _amount Amount of LP tokens to stake
     */
    function stake(uint256 _poolId, uint256 _amount) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        if (_amount == 0) revert AmountCannotBeZero();

        PoolInfo storage pool = poolInfo[_poolId];
        if (!pool.isActive) revert PoolNotActive();

        UserInfo storage user = userInfo[_poolId][msg.sender];

        updatePoolRewards(_poolId);

        // Calculate and store pending rewards
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accAmicaPerShare) / PRECISION - user.rewardDebt;
            user.unclaimedRewards += pending;
        }

        // Transfer LP tokens
        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Update user info
        user.amount += _amount;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / PRECISION;

        // Update pool info
        pool.totalStaked += _amount;
        poolWeightedTotal[_poolId] += _amount;
        userWeightedAmount[_poolId][msg.sender] += _amount;

        // Track user's pool participation
        _addUserToPool(msg.sender, _poolId);

        emit Deposit(msg.sender, _poolId, _amount);
    }

    /**
     * @notice Stake LP tokens with time lock for bonus rewards
     * @dev Locks tokens for specified duration with reward multiplier
     * @param _poolId Pool ID to stake in
     * @param _amount Amount of LP tokens to stake
     * @param _lockTierIndex Index of the lock tier to use
     */
    function stakeLocked(uint256 _poolId, uint256 _amount, uint256 _lockTierIndex) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        if (_amount == 0) revert AmountCannotBeZero();
        if (_lockTierIndex >= lockTiers.length) revert InvalidLockTier();

        PoolInfo storage pool = poolInfo[_poolId];
        if (!pool.isActive) revert PoolNotActive();

        updatePoolRewards(_poolId);

        // Get lock tier details
        LockTier memory tier = lockTiers[_lockTierIndex];
        uint256 unlockTime = block.timestamp + tier.duration;

        // Transfer LP tokens
        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Create lock entry
        LockInfo memory newLock = LockInfo({
            amount: _amount,
            unlockTime: unlockTime,
            lockMultiplier: tier.multiplier,
            rewardDebt: (_amount * tier.multiplier * pool.accAmicaPerShare) / (BASIS_POINTS * PRECISION),
            lockId: nextLockId++
        });

        userLocks[_poolId][msg.sender].push(newLock);

        // Update totals
        uint256 weightedAmount = (_amount * tier.multiplier) / BASIS_POINTS;
        pool.totalStaked += _amount;
        poolWeightedTotal[_poolId] += weightedAmount;
        userLockedAmount[_poolId][msg.sender] += _amount;
        userWeightedAmount[_poolId][msg.sender] += weightedAmount;

        // Track user's pool participation
        _addUserToPool(msg.sender, _poolId);

        emit DepositLocked(msg.sender, _poolId, _amount, newLock.lockId, unlockTime, tier.multiplier);
    }

    /**
     * @notice Withdraw flexible stake
     * @dev Withdraws unlocked tokens and updates rewards
     * @param _poolId Pool ID to withdraw from
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _poolId, uint256 _amount) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        if (user.amount < _amount) revert InsufficientBalance();

        updatePoolRewards(_poolId);

        // Calculate and store pending rewards
        uint256 pending = (user.amount * pool.accAmicaPerShare) / PRECISION - user.rewardDebt;
        user.unclaimedRewards += pending;

        // Update user info
        user.amount -= _amount;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / PRECISION;

        // Update pool info
        pool.totalStaked -= _amount;
        poolWeightedTotal[_poolId] -= _amount;
        userWeightedAmount[_poolId][msg.sender] -= _amount;

        // Remove from tracking if fully withdrawn
        if (user.amount == 0 && userLockedAmount[_poolId][msg.sender] == 0 && user.unclaimedRewards == 0) {
            _removeUserFromPool(msg.sender, _poolId);
        }

        // Transfer LP tokens
        pool.lpToken.safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _poolId, _amount);
    }

    /**
     * @notice Withdraw locked tokens after unlock time
     * @dev Finds and withdraws specific lock by ID
     * @param _poolId Pool ID
     * @param _lockId Lock ID to withdraw
     */
    function withdrawLocked(uint256 _poolId, uint256 _lockId) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        PoolInfo storage pool = poolInfo[_poolId];
        LockInfo[] storage locks = userLocks[_poolId][msg.sender];

        // Find and cache lock data
        uint256 lockIndex = type(uint256).max;
        uint256 locksLength = locks.length;
        LockInfo memory lockData; // Use memory for reads

        for (uint256 i = 0; i < locksLength; i++) {
            if (locks[i].lockId == _lockId) {
                lockIndex = i;
                lockData = locks[i]; // Copy to memory
                break;
            }
        }

        if (lockIndex == type(uint256).max) revert LockNotFound();
        if (block.timestamp < lockData.unlockTime) revert StillLocked();
        if (lockData.amount == 0) revert AlreadyWithdrawn();

        updatePoolRewards(_poolId);

        // Calculate rewards using cached data
        uint256 accAmicaPerShare = pool.accAmicaPerShare;
        uint256 weightedAmount = (lockData.amount * lockData.lockMultiplier) / BASIS_POINTS;
        uint256 pending = (weightedAmount * accAmicaPerShare) / PRECISION - lockData.rewardDebt;

        // Update states
        userInfo[_poolId][msg.sender].unclaimedRewards += pending;
        pool.totalStaked -= lockData.amount;
        poolWeightedTotal[_poolId] -= weightedAmount;
        userLockedAmount[_poolId][msg.sender] -= lockData.amount;
        userWeightedAmount[_poolId][msg.sender] -= weightedAmount;

        // Efficient array removal
        if (lockIndex < locksLength - 1) {
            locks[lockIndex] = locks[locksLength - 1];
        }
        locks.pop();

        // Check if user should be removed from pool
        UserInfo storage user = userInfo[_poolId][msg.sender];
        if (user.amount == 0 && userLockedAmount[_poolId][msg.sender] == 0 && user.unclaimedRewards == 0) {
            _removeUserFromPool(msg.sender, _poolId);
        }

        // Transfer tokens
        pool.lpToken.safeTransfer(msg.sender, lockData.amount);
        emit WithdrawLocked(msg.sender, _poolId, _lockId, lockData.amount);
    }

    /**
     * @notice Emergency exit from pool, forfeiting all rewards
     * @dev Withdraws all staked tokens (flexible and locked) without rewards
     * @param _poolId Pool ID to exit from
     */
    function emergencyExitPool(uint256 _poolId) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        uint256 totalAmount = user.amount;

        // Add locked amounts
        LockInfo[] storage locks = userLocks[_poolId][msg.sender];
        for (uint256 i = 0; i < locks.length; i++) {
            totalAmount += locks[i].amount;
        }

        if (totalAmount == 0) revert NothingToWithdraw();

        // Update pool totals
        pool.totalStaked -= totalAmount;
        poolWeightedTotal[_poolId] -= userWeightedAmount[_poolId][msg.sender];

        // Clear user data
        user.amount = 0;
        user.rewardDebt = 0;
        user.unclaimedRewards = 0;
        userLockedAmount[_poolId][msg.sender] = 0;
        userWeightedAmount[_poolId][msg.sender] = 0;
        delete userLocks[_poolId][msg.sender];

        // Remove from tracking
        _removeUserFromPool(msg.sender, _poolId);

        // Transfer LP tokens
        pool.lpToken.safeTransfer(msg.sender, totalAmount);

        emit EmergencyExit(msg.sender, _poolId, totalAmount);
    }

    /**
     * @notice Claim rewards from a specific pool
     * @dev Claims all pending rewards for the caller from specified pool
     * @param _poolId Pool ID to claim from
     */
    function claimPool(uint256 _poolId) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        updatePoolRewards(_poolId);

        PoolInfo storage pool = poolInfo[_poolId];
        UserInfo storage user = userInfo[_poolId][msg.sender];

        // Calculate total rewards including locks
        uint256 totalRewards = _calculateUserRewards(_poolId, msg.sender);

        if (totalRewards == 0) revert NoRewardsToClaim();

        // Update reward debts
        user.unclaimedRewards = 0;
        user.rewardDebt = (user.amount * pool.accAmicaPerShare) / PRECISION;
        user.lastClaimBlock = block.number;

        // Update lock reward debts
        LockInfo[] storage locks = userLocks[_poolId][msg.sender];
        for (uint256 i = 0; i < locks.length; i++) {
            if (locks[i].amount > 0) {
                uint256 weightedAmount = (locks[i].amount * locks[i].lockMultiplier) / BASIS_POINTS;
                locks[i].rewardDebt = (weightedAmount * pool.accAmicaPerShare) / PRECISION;
            }
        }

        // Transfer rewards
        amicaToken.safeTransfer(msg.sender, totalRewards);

        emit RewardsClaimed(msg.sender, totalRewards);
    }

    /**
     * @notice Claim all rewards from all pools
     * @dev Gas-optimized batch claim across all user's active pools
     */
    function claimAll() external nonReentrant {
        uint256 totalRewards = 0;
        uint256[] storage activePools = userActivePools[msg.sender];
        uint256 activePoolsLength = activePools.length; // Cache length

        // Temporary storage for batch updates
        uint256[] memory poolsToUpdate = new uint256[](activePoolsLength);
        uint256[] memory poolRewards = new uint256[](activePoolsLength);
        uint256 updateCount = 0;

        // First pass: calculate all rewards
        for (uint256 i = 0; i < activePoolsLength; i++) {
            uint256 poolId = activePools[i];
            updatePoolRewards(poolId);

            uint256 rewards = _calculateUserRewards(poolId, msg.sender);
            if (rewards > 0) {
                poolRewards[updateCount] = rewards;
                poolsToUpdate[updateCount] = poolId;
                totalRewards += rewards;
                updateCount++;
            }
        }

        if (totalRewards == 0) revert NoRewardsToClaim();

        // Second pass: update all states
        for (uint256 i = 0; i < updateCount; i++) {
            uint256 poolId = poolsToUpdate[i];
            PoolInfo storage pool = poolInfo[poolId];
            UserInfo storage user = userInfo[poolId][msg.sender];

            // Cache values
            uint256 accAmicaPerShare = pool.accAmicaPerShare;

            // Update user state
            user.unclaimedRewards = 0;
            user.rewardDebt = (user.amount * accAmicaPerShare) / PRECISION;
            user.lastClaimBlock = block.number;

            // Update lock reward debts
            LockInfo[] storage locks = userLocks[poolId][msg.sender];
            uint256 locksLength = locks.length;

            for (uint256 j = 0; j < locksLength; j++) {
                LockInfo storage lock = locks[j];
                if (lock.amount > 0) {
                    uint256 weightedAmount = (lock.amount * lock.lockMultiplier) / BASIS_POINTS;
                    lock.rewardDebt = (weightedAmount * accAmicaPerShare) / PRECISION;
                }
            }
        }

        // Single transfer at the end
        amicaToken.safeTransfer(msg.sender, totalRewards);
        emit RewardsClaimed(msg.sender, totalRewards);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get pool ID by LP token address
     * @param _lpToken LP token address
     * @return Pool ID (reverts if not found)
     */
    function getPoolIdByLpToken(address _lpToken) external view returns (uint256) {
        uint256 poolId = lpTokenToPoolId[_lpToken];
        if (poolId == 0) revert PoolNotFound();
        return poolId - 1;
    }

    /**
     * @notice Get list of pools where user has stake
     * @param _user User address
     * @return Array of pool IDs
     */
    function getUserActivePools(address _user) external view returns (uint256[] memory) {
        return userActivePools[_user];
    }

    /**
     * @notice Get pool allocation percentage
     * @param _poolId Pool ID
     * @return Allocation in basis points
     */
    function getPoolAllocationPercentage(uint256 _poolId) external view returns (uint256) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        return poolInfo[_poolId].allocBasisPoints;
    }

    /**
     * @notice Get total number of pools
     * @return Number of pools
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Get total number of lock tiers
     * @return Number of lock tiers
     */
    function lockTiersLength() external view returns (uint256) {
        return lockTiers.length;
    }

    /**
     * @notice Get user's locks for a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return Array of lock information
     */
    function getUserLocks(uint256 _poolId, address _user) external view returns (LockInfo[] memory) {
        return userLocks[_poolId][_user];
    }

    /**
     * @notice Get user's total staked amount (flexible + locked)
     * @param _poolId Pool ID
     * @param _user User address
     * @return Total staked amount
     */
    function getUserTotalStaked(uint256 _poolId, address _user) external view returns (uint256) {
        return userInfo[_poolId][_user].amount + userLockedAmount[_poolId][_user];
    }

    /**
     * @notice Get user's effective stake (with multipliers applied)
     * @param _poolId Pool ID
     * @param _user User address
     * @return Weighted stake amount
     */
    function getUserEffectiveStake(uint256 _poolId, address _user) external view returns (uint256) {
        return userWeightedAmount[_poolId][_user];
    }

    /**
     * @notice Get pending rewards for a specific pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return Pending reward amount
     */
    function pendingRewardsForPool(uint256 _poolId, address _user) external view returns (uint256) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        return _calculateUserRewards(_poolId, _user);
    }

    /**
     * @notice Get estimated total pending rewards across all pools
     * @param _user User address
     * @return Total pending rewards
     */
    function estimatedTotalPendingRewards(address _user) external view returns (uint256) {
        uint256 totalPending = 0;
        uint256[] storage activePools = userActivePools[_user];

        for (uint256 i = 0; i < activePools.length; i++) {
            totalPending += _calculateUserRewards(activePools[i], _user);
        }

        return totalPending;
    }

    /**
     * @notice Get comprehensive pool information
     * @param _poolId Pool ID
     * @return lpToken LP token address
     * @return allocBasisPoints Allocation basis points
     * @return totalStaked Total tokens staked
     * @return weightedTotal Total weighted stake
     * @return isActive Pool active status
     * @return isAgentPool Whether it's an agent pool
     */
    function getPoolInfo(uint256 _poolId) external view returns (
        address lpToken,
        uint256 allocBasisPoints,
        uint256 totalStaked,
        uint256 weightedTotal,
        bool isActive,
        bool isAgentPool
    ) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        PoolInfo storage pool = poolInfo[_poolId];

        return (
            address(pool.lpToken),
            pool.allocBasisPoints,
            pool.totalStaked,
            poolWeightedTotal[_poolId],
            pool.isActive,
            pool.isAgentPool
        );
    }

    /**
     * @notice Get comprehensive user information for a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return flexibleAmount Amount staked without lock
     * @return lockedAmount Total locked amount
     * @return effectiveStake Weighted stake amount
     * @return unclaimedRewards Unclaimed rewards
     * @return numberOfLocks Number of active locks
     */
    function getUserInfo(uint256 _poolId, address _user) external view returns (
        uint256 flexibleAmount,
        uint256 lockedAmount,
        uint256 effectiveStake,
        uint256 unclaimedRewards,
        uint256 numberOfLocks
    ) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        UserInfo storage user = userInfo[_poolId][_user];

        return (
            user.amount,
            userLockedAmount[_poolId][_user],
            userWeightedAmount[_poolId][_user],
            user.unclaimedRewards,
            userLocks[_poolId][_user].length
        );
    }

    /**
     * @notice Get lock tier details
     * @param _index Tier index
     * @return duration Lock duration in seconds
     * @return multiplier Reward multiplier in basis points
     */
    function getLockTier(uint256 _index) external view returns (uint256 duration, uint256 multiplier) {
        if (_index >= lockTiers.length) revert InvalidIndex();
        LockTier memory tier = lockTiers[_index];
        return (tier.duration, tier.multiplier);
    }

    /**
     * @notice Calculate reward multiplier for a block range
     * @dev Takes into account the end block if set
     * @param _from Start block
     * @param _to End block
     * @return Block count multiplier
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
     * @notice Get remaining allocation available for new pools
     * @return Available basis points
     */
    function getRemainingAllocation() external view returns (uint256) {
        return BASIS_POINTS - totalAllocBasisPoints;
    }
}
