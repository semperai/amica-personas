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
 * @notice Gas-optimized staking with time-locked bonus multipliers
 * @dev Lock stakes for higher rewards
 */
contract PersonaStakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct PoolInfo {
        IERC20 lpToken;           // LP token address
        uint256 allocBasisPoints; // Allocation in basis points (100 = 1%)
        uint256 lastRewardBlock;  // Last block number that rewards were calculated
        uint256 accAmicaPerShare; // Accumulated AMICA per share, times 1e18
        uint256 totalStaked;      // Total LP tokens staked
        bool isAgentPool;         // True if this is a Persona/Agent pool
        uint256 personaTokenId;   // Associated persona token ID
        bool isActive;            // Pool status
    }

    struct UserInfo {
        uint256 amount;           // LP tokens staked by user
        uint256 rewardDebt;       // Reward debt
        uint256 unclaimedRewards; // Unclaimed rewards for this pool
        uint256 lastClaimBlock;   // Last block user claimed from this pool
    }

    struct LockInfo {
        uint256 amount;           // Locked amount
        uint256 unlockTime;       // When tokens can be withdrawn
        uint256 lockMultiplier;   // Multiplier in basis points (10000 = 1x)
        uint256 rewardDebt;       // Reward debt for this lock
        uint256 lockId;           // Unique lock ID
    }

    struct LockTier {
        uint256 duration;         // Lock duration in seconds
        uint256 multiplier;       // Reward multiplier in basis points
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    IERC20 public immutable amicaToken;
    IPersonaTokenFactory public immutable personaFactory;

    uint256 public amicaPerBlock;        // AMICA tokens distributed per block
    uint256 public totalAllocBasisPoints; // Total allocation basis points (max 10000)
    uint256 public startBlock;            // Start block for rewards
    uint256 public endBlock;              // End block for rewards (0 = no end)
    uint256 public lastMassUpdateBlock;   // Last block when mass update was called

    // Pool and user data
    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;  // poolId => user => info
    mapping(address => uint256) public lpTokenToPoolId;                // LP token => poolId

    // Lock data
    mapping(uint256 => mapping(address => LockInfo[])) public userLocks;  // poolId => user => locks
    mapping(uint256 => mapping(address => uint256)) public userLockedAmount;  // poolId => user => total locked
    mapping(uint256 => mapping(address => uint256)) public userWeightedAmount; // poolId => user => amount * multiplier
    mapping(uint256 => uint256) public poolWeightedTotal;  // poolId => total weighted stake

    // Lock tiers
    LockTier[] public lockTiers;
    uint256 public nextLockId = 1;

    // User tracking
    mapping(address => uint256[]) public userActivePools;              // User => array of pool IDs
    mapping(address => mapping(uint256 => bool)) public userHasStake;  // User => poolId => has stake
    mapping(address => uint256) public userTotalPendingRewards;        // Cached total pending rewards
    mapping(address => uint256) public userLastGlobalUpdate;           // Last block user's global state was updated

    // Constants
    uint256 public constant BASIS_POINTS = 10000;         // 100% = 10000 basis points
    uint256 public constant PRECISION = 1e18;             // Higher precision for calculations
    uint256 public constant MAX_LOCK_MULTIPLIER = 50000; // Max 5x multiplier

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PoolAdded(uint256 indexed poolId, address indexed lpToken, uint256 allocBasisPoints, bool isAgentPool);
    event PoolUpdated(uint256 indexed poolId, uint256 allocBasisPoints, bool isActive);
    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);
    event DepositLocked(address indexed user, uint256 indexed poolId, uint256 amount, uint256 lockId, uint256 unlockTime, uint256 multiplier);
    event Withdraw(address indexed user, uint256 indexed poolId, uint256 amount);
    event WithdrawLocked(address indexed user, uint256 indexed poolId, uint256 lockId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 amicaPerBlock);
    event RewardPeriodUpdated(uint256 startBlock, uint256 endBlock);
    event LockTierAdded(uint256 duration, uint256 multiplier);
    event LockTierUpdated(uint256 index, uint256 duration, uint256 multiplier);
    event EmergencyExit(address indexed user, uint256 indexed poolId, uint256 amount);
    event EmergencyWithdraw(address indexed token, uint256 amount);

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
     * @notice Add a new LP pool
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
     * @notice Add or update lock tier
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
     * @notice Update pool allocation or status
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
     * @notice Update reward rate
     */
    function updateRewardRate(uint256 _amicaPerBlock) external onlyOwner {
        _updateGlobalRewards();
        amicaPerBlock = _amicaPerBlock;
        emit RewardRateUpdated(_amicaPerBlock);
    }

    /**
     * @notice Update reward period
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
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) revert InvalidToken();

        // Check if token is an LP token in any pool
        for (uint256 i = 0; i < poolInfo.length; i++) {
            if (address(poolInfo[i].lpToken) == _token) revert CannotWithdrawLPTokens();
        }

        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit EmergencyWithdraw(_token, _amount);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Update global state checkpoint
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
     * @notice Track user's pool participation
     */
    function _addUserToPool(address user, uint256 poolId) internal {
        if (!userHasStake[user][poolId]) {
            userHasStake[user][poolId] = true;
            userActivePools[user].push(poolId);
        }
    }

    /**
     * @notice Remove user from pool tracking
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
     * @notice Calculate rewards including lock multipliers
     */
    function _calculateUserRewards(uint256 poolId, address user) internal view returns (uint256) {
        PoolInfo storage pool = poolInfo[poolId];
        UserInfo storage userStake = userInfo[poolId][user];

        uint256 accAmicaPerShare = pool.accAmicaPerShare;

        // Calculate updated accAmicaPerShare if needed
        if (block.number > pool.lastRewardBlock && poolWeightedTotal[poolId] > 0 && pool.isActive) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 amicaReward = (multiplier * amicaPerBlock * pool.allocBasisPoints) / BASIS_POINTS;

            accAmicaPerShare += (amicaReward * PRECISION) / poolWeightedTotal[poolId];
        }

        // Calculate rewards for flexible stake
        uint256 totalRewards = userStake.unclaimedRewards;
        if (userStake.amount > 0) {
            totalRewards += (userStake.amount * accAmicaPerShare) / PRECISION - userStake.rewardDebt;
        }

        // Calculate rewards for each lock
        LockInfo[] storage locks = userLocks[poolId][user];
        for (uint256 i = 0; i < locks.length; i++) {
            if (locks[i].amount > 0) {
                uint256 weightedAmount = (locks[i].amount * locks[i].lockMultiplier) / BASIS_POINTS;
                totalRewards += (weightedAmount * accAmicaPerShare) / PRECISION - locks[i].rewardDebt;
            }
        }

        return totalRewards;
    }

    // ============================================================================
    // PUBLIC FUNCTIONS
    // ============================================================================

    /**
     * @notice Update rewards for a specific pool
     */
    function updatePoolRewards(uint256 _poolId) public {
        PoolInfo storage pool = poolInfo[_poolId];

        if (block.number <= pool.lastRewardBlock || !pool.isActive) {
            return;
        }

        uint256 weightedTotal = poolWeightedTotal[_poolId];
        if (weightedTotal == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 amicaReward = (multiplier * amicaPerBlock * pool.allocBasisPoints) / BASIS_POINTS;

        pool.accAmicaPerShare += (amicaReward * PRECISION) / weightedTotal;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @notice Stake LP tokens (flexible, no lock)
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
     * @notice Withdraw a specific lock after unlock time
     */
    function withdrawLocked(uint256 _poolId, uint256 _lockId) external nonReentrant {
        if (_poolId >= poolInfo.length) revert InvalidPool();

        PoolInfo storage pool = poolInfo[_poolId];
        LockInfo[] storage locks = userLocks[_poolId][msg.sender];

        // Find the lock
        uint256 lockIndex = type(uint256).max;
        for (uint256 i = 0; i < locks.length; i++) {
            if (locks[i].lockId == _lockId) {
                lockIndex = i;
                break;
            }
        }

        if (lockIndex == type(uint256).max) revert LockNotFound();
        LockInfo memory lock = locks[lockIndex];
        if (block.timestamp < lock.unlockTime) revert StillLocked();
        if (lock.amount == 0) revert AlreadyWithdrawn();

        updatePoolRewards(_poolId);

        // Calculate rewards for this lock
        uint256 weightedAmount = (lock.amount * lock.lockMultiplier) / BASIS_POINTS;
        uint256 pending = (weightedAmount * pool.accAmicaPerShare) / PRECISION - lock.rewardDebt;

        // Add to unclaimed rewards
        userInfo[_poolId][msg.sender].unclaimedRewards += pending;

        // Update totals
        pool.totalStaked -= lock.amount;
        poolWeightedTotal[_poolId] -= weightedAmount;
        userLockedAmount[_poolId][msg.sender] -= lock.amount;
        userWeightedAmount[_poolId][msg.sender] -= weightedAmount;

        // Remove lock (swap with last and pop)
        locks[lockIndex] = locks[locks.length - 1];
        locks.pop();

        // Check if user should be removed from pool
        UserInfo storage user = userInfo[_poolId][msg.sender];
        if (user.amount == 0 && userLockedAmount[_poolId][msg.sender] == 0 && user.unclaimedRewards == 0) {
            _removeUserFromPool(msg.sender, _poolId);
        }

        // Transfer LP tokens
        pool.lpToken.safeTransfer(msg.sender, lock.amount);

        emit WithdrawLocked(msg.sender, _poolId, _lockId, lock.amount);
    }

    /**
     * @notice Emergency exit from pool (forfeit rewards)
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
     * @notice Claim all rewards (limited to user's active pools)
     */
    function claimAll() external nonReentrant {
        uint256 totalRewards = 0;
        uint256[] storage activePools = userActivePools[msg.sender];

        // Only iterate through user's active pools
        for (uint256 i = 0; i < activePools.length; i++) {
            uint256 poolId = activePools[i];
            updatePoolRewards(poolId);

            uint256 poolRewards = _calculateUserRewards(poolId, msg.sender);
            if (poolRewards > 0) {
                totalRewards += poolRewards;

                // Update state
                PoolInfo storage pool = poolInfo[poolId];
                UserInfo storage user = userInfo[poolId][msg.sender];

                user.unclaimedRewards = 0;
                user.rewardDebt = (user.amount * pool.accAmicaPerShare) / PRECISION;
                user.lastClaimBlock = block.number;

                // Update lock reward debts
                LockInfo[] storage locks = userLocks[poolId][msg.sender];
                for (uint256 j = 0; j < locks.length; j++) {
                    if (locks[j].amount > 0) {
                        uint256 weightedAmount = (locks[j].amount * locks[j].lockMultiplier) / BASIS_POINTS;
                        locks[j].rewardDebt = (weightedAmount * pool.accAmicaPerShare) / PRECISION;
                    }
                }
            }
        }

        if (totalRewards == 0) revert NoRewardsToClaim();

        amicaToken.safeTransfer(msg.sender, totalRewards);
        emit RewardsClaimed(msg.sender, totalRewards);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get pool ID by LP token address
     */
    function getPoolIdByLpToken(address _lpToken) external view returns (uint256) {
        uint256 poolId = lpTokenToPoolId[_lpToken];
        if (poolId == 0) revert PoolNotFound();
        return poolId - 1;
    }

    /**
     * @notice Get user's active pools
     */
    function getUserActivePools(address _user) external view returns (uint256[] memory) {
        return userActivePools[_user];
    }

    /**
     * @notice Get pool allocation percentage
     */
    function getPoolAllocationPercentage(uint256 _poolId) external view returns (uint256) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        return poolInfo[_poolId].allocBasisPoints;
    }

    /**
     * @notice Get number of pools
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Get number of lock tiers
     */
    function lockTiersLength() external view returns (uint256) {
        return lockTiers.length;
    }

    /**
     * @notice Get user's locks for a pool
     */
    function getUserLocks(uint256 _poolId, address _user) external view returns (LockInfo[] memory) {
        return userLocks[_poolId][_user];
    }

    /**
     * @notice Get user's total staked (flexible + locked)
     */
    function getUserTotalStaked(uint256 _poolId, address _user) external view returns (uint256) {
        return userInfo[_poolId][_user].amount + userLockedAmount[_poolId][_user];
    }

    /**
     * @notice Get user's effective stake (with multipliers)
     */
    function getUserEffectiveStake(uint256 _poolId, address _user) external view returns (uint256) {
        return userWeightedAmount[_poolId][_user];
    }

    /**
     * @notice Get pending rewards for a specific pool
     */
    function pendingRewardsForPool(uint256 _poolId, address _user) external view returns (uint256) {
        if (_poolId >= poolInfo.length) revert InvalidPool();
        return _calculateUserRewards(_poolId, _user);
    }

    /**
     * @notice Get estimated total pending rewards across all pools
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
     * @notice Get pool info
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
     * @notice Get user info for a specific pool
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
     */
    function getLockTier(uint256 _index) external view returns (uint256 duration, uint256 multiplier) {
        if (_index >= lockTiers.length) revert InvalidIndex();
        LockTier memory tier = lockTiers[_index];
        return (tier.duration, tier.multiplier);
    }

    /**
     * @notice Get reward multiplier
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
     * @notice Get remaining allocation
     */
    function getRemainingAllocation() external view returns (uint256) {
        return BASIS_POINTS - totalAllocBasisPoints;
    }
}
