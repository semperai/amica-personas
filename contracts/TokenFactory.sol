// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

abstract contract ERC20Base {
    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) public virtual;
}

abstract contract AmicaToken {
    function deposit(address tokenAddress, uint256 amount) public virtual;
}

interface IUniswapV2Router {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

contract TokenFactory is ERC721, Ownable {
    struct NFTData {
        string name;
        string symbol;
        mapping(string => string) metadata;
        address erc20Token;
        address pairToken;
        bool pairCreated;
    }

    struct PairingToken {
        address token; // which token should the persona token be paired with
        uint256 mintCost; // wei (how much to initially mint the token)
        uint256 graduationCost; // wei (how much for uniswap pair to be created)
        uint256 amicaDepositCost; // wei (how much goes to amica contract)
    }

    IERC20 public immutable amicaToken;
    IUniswapV2Factory public immutable uniswapFactory;
    IUniswapV2Router public immutable uniswapRouter;
    address public immutable erc20Implementation;
    
    uint256 private _tokenIdCounter;
    mapping(uint256 => NFTData) public nftData;
    mapping(address => PairingToken) public pairingTokens;

    event MetadataUpdated(uint256 indexed tokenId);
    event PersonaCreated(uint256 indexed tokenId, address indexed erc20Address, address indexed pairingERC20Address);
    event PairCreated(uint256 indexed tokenId, address indexed pairAddress);
    event ModifyPairingToken(address indexed token, uint256 mintCost, uint256 graduationCost);

    constructor(
        address _amicaToken,
        address _uniswapFactory,
        address _uniswapRouter,
        address _erc20Implementation
    ) ERC721("Amica NFT", "AINFT") Ownable(msg.sender) {
        amicaToken = IERC20(_amicaToken);
        uniswapFactory = IUniswapV2Factory(_uniswapFactory);
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        erc20Implementation = _erc20Implementation;

        pairingTokens[address(amicaToken)] = PairingToken({
            token: address(amicaToken),
            mintCost: 1000 ether,
            graduationCost: 10 ether,
            amicaDepositCost: 300_000_000 ether
        });
    }

    function setPairingToken(
        address _token, // which token should the persona token be paired with
        uint256 _mintCost, // wei (how much to initially mint the token)
        uint256 _graduationCost, // wei (how much for uniswap pair to be created)
        uint256 _amicaDepositCost // wei (how much goes to amica contract)
    ) external onlyOwner {
        pairingTokens[_token] = PairingToken({
            token: _token,
            mintCost: _mintCost,
            graduationCost: _graduationCost,
            amicaDepositCost: _amicaDepositCost
        });
    }

    /// @notice Mint new persona
    /// @param _pairingToken which token to pair against the new token
    /// @param _name Name of persona
    /// @param _symbol Symbol of persona
    /// @param _keys metadata kv keys
    /// @param _values metadata kv values
    function mint(
        address _pairingToken,
        string memory _name,
        string memory _symbol,
        string[] memory _keys,
        string[] memory _values
    ) external {
        require(pairingTokens[_pairingToken].token != address(0x0), "Pairing token not supported");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Name cannot be empty");
        require(_keys.length == _values.length, "Invalid metadata");

        uint256 tokenId = _tokenIdCounter++;
        amicaToken.transferFrom(msg.sender, address(this), pairingTokens[_pairingToken].mintCost);

        nftData[tokenId].name = _name;
        nftData[tokenId].symbol = _symbol;

        for (uint256 i = 0; i < _keys.length; i++) {
            nftData[tokenId].metadata[_keys[i]] = _values[i];
        }

        _safeMint(msg.sender, tokenId);

        // Deploy ERC20 token using Clone
        address erc20Clone = Clones.clone(erc20Implementation);
        ERC20Base(erc20Clone).initialize(
            string(abi.encodePacked(_name, ".amica")),
            string(abi.encodePacked(_symbol, ".amica")),
            1_000_000_000 ether,
            address(this)
        );

        // send portion of tokens to Amica contract
        IERC20(erc20Clone).approve(address(amicaToken), pairingTokens[_pairingToken].amicaDepositCost);
        AmicaToken(address(amicaToken)).deposit(erc20Clone, pairingTokens[_pairingToken].amicaDepositCost);
        
        nftData[tokenId].erc20Token = erc20Clone;
        nftData[tokenId].pairToken = _pairingToken;

        emit PersonaCreated(tokenId, erc20Clone, _pairingToken);
    }

    /// @notice Sets metadata
    /// @dev The owner of the NFT can configure its metadata
    /// @param _tokenId the tokenID of the NFT
    /// @param _keys list of keys to set
    /// @param _values list of values corresponding to keys
    function setMetadata(
        uint256 _tokenId,
        string[] memory _keys,
        string[] memory _values
    ) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        for (uint256 i = 0; i < _keys.length; i++) {
            nftData[_tokenId].metadata[_keys[i]] = _values[i];
        }
        emit MetadataUpdated(_tokenId);
    }

    /// @notice Retrieves metadata values
    /// @param _tokenId the tokenID
    /// @param _keys list of keys to retrieve
    /// @return string data
    function getMetadata(
        uint256 _tokenId,
        string[] memory _keys
    ) external view returns (string[] memory) {
        string[] memory values = new string[](_keys.length);
        for (uint256 i = 0; i < _keys.length; i++) {
            values[i] = nftData[_tokenId].metadata[_keys[i]];
        }
        return values;
    }

    // buy nft tokens with aius
    // @param _tokenId NFT token ID
    // @param _amount amount of tokens to spend
    // @param _minimum minimum amount of nft tokens to receive
    function buyTokens(uint256 _tokenId, uint256 _amount, uint256 _minimum) external {
        require(!nftData[_tokenId].pairCreated, "Sale completed");

        /*
        amicaToken.transferFrom(msg.sender, address(this), _amount);

        uint256 owed = calculateOwed(
            nftData[_tokenId].amicaDeposited,
            nftData[_tokenId].aiusDeposied + _remainingAmount
        );
        require(owed >= _minimum, "slippage");

        if (nftData[tokenId].amicaDeposited == 100 ether) {
            _createPair(tokenId);
        }

        emit TokenBuy(_tokenId, _amount);
        */
    }

    
    // calculates the amount of token b owed based on starting and ending balance of token a (either a buy or a sell of token a into the pool between token a and token b)
    // @dev calculateOwed(a, b)=calculateOwed(b, a)
    // @param start starting balance of token a
    // @param end ending balance of token a
    // @returns amount of token b
    function calculateOwed(uint256 _start, uint256 _end) public pure returns (uint256) {
        /*
        require(start < end && end <= 100 ether , "Invalid amount");
        uint256 START_PRICE = 1_000_000;
        uint256 END_PRICE = 10_000_000;

        uint256 mid = (start + end) / 2;
        uint256 avg = (START_PRICE + END_PRICE) / (mid / 100 ether);
        return avg;
        */
       return 0;
    }

    /// @notice Creates uniswap pair
    function _createPair(uint256 _tokenId) private {
        address erc20Token = nftData[_tokenId].erc20Token;

        // Transfer collected AIUS and 890M tokens for liquidity
        uint256 tokenAmount = IERC20(erc20Token).balanceOf(address(this));
        uint256 aiusAmount = 90 ether;

        // Approve transfers
        IERC20(erc20Token).approve(address(uniswapRouter), tokenAmount);
        amicaToken.approve(address(uniswapRouter), aiusAmount);

        // Create pair and add liquidity
        uniswapFactory.createPair(erc20Token, address(amicaToken));
        IUniswapV2Router(uniswapRouter).addLiquidity(
            erc20Token,
            address(amicaToken),
            tokenAmount,
            aiusAmount,
            0,
            0,
            ownerOf(_tokenId),
            block.timestamp + 15 minutes
        );

        // Send remaining 10 AIUS to NFT owner
        amicaToken.transfer(ownerOf(_tokenId), 10 ether);
        
        nftData[_tokenId].pairCreated = true;
        emit PairCreated(_tokenId, uniswapFactory.getPair(erc20Token, address(amicaToken)));
    }
}
