// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {Ownable} from "./utils/Ownable.sol";

/// @title SessionKeyRegistry
/// @notice EIP-712 delegation registry: a user's main wallet signs one typed
///         delegation granting an agent's ephemeral session key a bounded
///         authority, and this contract is where anyone can verify that grant
///         without trusting a server.
///
/// Why this exists (ADR-004, the connection between the two threads):
/// the RFC that drove this design put its answer to "how does an agent act
/// autonomously" off-chain, in a local Redis pool. A judge cannot verify a
/// Redis key. Moving the *authorisation* on-chain means every grant, every
/// spend and every revoke has a transaction hash — which is the property the
/// scoring criteria ask for. Bounded execution stays where it belongs; what
/// moves on-chain is the proof of who was allowed to do what.
///
/// Relationship to `backend/internal/agentcard` (read before adding a field):
/// agentcard already enforces limits, daily caps, freezing and allowlists
/// off-chain, and ADR-004 D3 says to upgrade that module rather than build a
/// parallel one beside it. This contract is *not* a second delegation
/// system: it is the on-chain anchor for the *same* delegation, so the two
/// sides verify one signature over one typed structure. Field names and
/// semantics below are deliberately the ones agentcard and the `SessionKey`
/// entity already use (`maxSpendPerTx`, `dailySpendLimit`, `validUntil`). If
/// you change a field here, change it in those two places in the same commit —
/// three models of the same thing is exactly the drift GAP-24 records.
///
/// What is NOT here, on purpose:
///   - No token movement. This registry authorises; it never custodies. Funds
///     stay in the Vault, so a compromised session key cannot drain anything.
///   - No Redis. D2 of ADR-004 leaves the off-chain pre-deduction out, and the
///     RFC's Lua for it carries four measured defects (GAP-18~21).
///   - No unlimited escape hatch. A delegation with no caps is not a
///     delegation.
contract SessionKeyRegistry is Ownable {
    // ---------------------------------------------------------------------
    // EIP-712
    // ---------------------------------------------------------------------

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// Mirrors RFC-001 4.1.1, with two deliberate changes:
    ///   - `sessionPublicKey` renamed to `sessionKey` for brevity;
    ///   - `agentId` is an `address`, not `bytes32`, so it matches the
    ///     `session_key_address` column the off-chain side already stores.
    bytes32 public constant AGENT_DELEGATION_TYPEHASH = keccak256(
        "AgentDelegation(address user,address agent,address sessionKey,uint256 maxSpendPerTx,uint256 dailySpendLimit,uint256 maxTxPerWindow,uint256 txWindowSeconds,uint256 validUntil,uint256 nonce)"
    );

    bytes32 private constant NAME_HASH = keccak256("Koliance");
    bytes32 private constant VERSION_HASH = keccak256("1");

    /// secp256k1 half-order. `ecrecover` accepts malleable signatures whose `s`
    /// sits in the upper half; rejecting them stops one consent from having
    /// two distinct encodings.
    uint256 private constant SECP256K1N_DIV_2 =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    uint256 private constant ONE_DAY = 1 days;

    /// @dev Cached domain separator, invalidated when the chain id changes so
    ///      a signature collected on one chain cannot be replayed on a fork.
    bytes32 private immutable _initialDomainSeparator;
    uint256 private immutable _initialChainId;

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    struct Delegation {
        address user;
        address agent;
        address sessionKey;
        uint256 maxSpendPerTx;
        uint256 dailySpendLimit;
        /// Frequency limit: at most `maxTxPerWindow` spends in any
        /// `txWindowSeconds` window. Signed by the user like every other cap,
        /// so a relayer cannot loosen it.
        uint256 maxTxPerWindow;
        uint256 txWindowSeconds;
        uint256 validUntil;
        uint256 nonce;
        uint256 spentInWindow;
        uint256 windowStart;
        uint256 txInWindow;
        uint256 txWindowStart;
        bool exists;
        bool revoked;
        bool frozen;
    }

    /// The signed terms, exactly the fields of the EIP-712 `AgentDelegation`
    /// struct in the same order. Passed as one calldata struct so the
    /// registration entry point stays within the EVM stack limit.
    struct DelegationTerms {
        address user;
        address agent;
        address sessionKey;
        uint256 maxSpendPerTx;
        uint256 dailySpendLimit;
        uint256 maxTxPerWindow;
        uint256 txWindowSeconds;
        uint256 validUntil;
        uint256 nonce;
    }

    /// One active delegation per session key. A session key is ephemeral by
    /// definition, so re-registering the same address replaces rather than
    /// appends.
    mapping(address sessionKey => Delegation) private _delegations;

    /// @notice The module authorised to *charge* a delegation on a user's behalf.
    /// @dev See `setSpendConsumer`. Distinct from the agent: the agent decides
    ///      to act, this decides to bill. On the perp path they differ — the
    ///      manager charges, the agent acts.
    ///
    ///      This is a contract, and that is deliberate: billing authority
    ///      belongs to whatever can prove the action happened, and on this
    ///      repository that is `PositionManager`.
    address public spendConsumer;

    /// @dev Monotonic user nonce for EIP-712 delegations (S-1).
    mapping(address user => uint256) public userNonce;

    /// @dev Replay guard. While unrevoked, a delegation is a bearer instrument,
    ///      so the same signed payload must not register twice — including
    ///      after a revoke, which is what makes revocation stick.
    mapping(address user => mapping(uint256 nonce => bool)) public nonceUsed;

    event DelegationRegistered(
        address indexed user,
        address indexed agent,
        address indexed sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 maxTxPerWindow,
        uint256 txWindowSeconds,
        uint256 validUntil,
        uint256 nonce
    );
    event SpendAuthorized(address indexed sessionKey, address indexed agent, uint256 amount, uint256 spentInWindow);
    event DelegationRevoked(address indexed user, address indexed sessionKey);
    event NonceInvalidated(address indexed user, uint256 newNonce);
    event SessionKeyFrozen(address indexed sessionKey, address indexed by);
    event SessionKeyUnfrozen(address indexed sessionKey, address indexed by);
    event SpendConsumerSet(address indexed consumer);

    // `ZeroAddress` is inherited from `Ownable`; redeclaring it here shadows
    // the parent's error and Hardhat refuses the duplicate declaration.
    error InvalidSignature();
    error SignatureMalleable();
    error NonceAlreadyUsed(address user, uint256 nonce);
    error InvalidNonce(uint256 expected, uint256 actual);
    error ValidityInThePast(uint256 validUntil, uint256 currentTime);
    error SessionKeyAlreadyBound(address sessionKey, address user);
    error SelfDelegation();
    error NoSpendConsumerSet();
    error NoSuchDelegation(address sessionKey);
    error DelegationIsRevoked(address sessionKey);
    error DelegationIsFrozen(address sessionKey);
    error DelegationExpired(address sessionKey, uint256 validUntil);
    error ExceededPerTxLimit(uint256 amount, uint256 limit);
    error ExceededDailyLimit(uint256 amount, uint256 windowSpent, uint256 limit);
    /// The delegation's frequency limit: `txInWindow` spends already made in
    /// the current `windowSeconds` window, which allows at most `limit`.
    error ExceededRateLimit(uint256 txInWindow, uint256 limit, uint256 windowSeconds);
    /// A delegation must bound frequency too: zero spends or a zero-length
    /// window would mean either no authority or no limit.
    error InvalidRateLimit(uint256 maxTxPerWindow, uint256 txWindowSeconds);
    error NotAuthorizedCaller(address caller);
    error ZeroAmount();

    constructor() Ownable() {
        _initialChainId = block.chainid;
        _initialDomainSeparator = _buildDomainSeparator();
    }

    // ---------------------------------------------------------------------
    // EIP-712 helpers
    // ---------------------------------------------------------------------

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /// @notice Domain separator, rebuilt if the chain id changed since deploy.
    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _initialChainId ? _initialDomainSeparator : _buildDomainSeparator();
    }

    /// @notice The 32-byte struct hash a signer commits to.
    /// @dev Exposed so an off-chain verifier (and the tests) can reproduce the
    ///      digest without re-implementing the encoding — the RFC described
    ///      this structure but nothing verified it, which is how GAP-24's
    ///      three incompatible models came about.
    function hashDelegation(
        address user,
        address agent,
        address sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 maxTxPerWindow,
        uint256 txWindowSeconds,
        uint256 validUntil,
        uint256 nonce
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                AGENT_DELEGATION_TYPEHASH,
                user,
                agent,
                sessionKey,
                maxSpendPerTx,
                dailySpendLimit,
                maxTxPerWindow,
                txWindowSeconds,
                validUntil,
                nonce
            )
        );
    }

    /// @notice Full EIP-712 digest — the bytes that are actually signed.
    function delegationDigest(
        address user,
        address agent,
        address sessionKey,
        uint256 maxSpendPerTx,
        uint256 dailySpendLimit,
        uint256 maxTxPerWindow,
        uint256 txWindowSeconds,
        uint256 validUntil,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator(),
                hashDelegation(
                    user, agent, sessionKey, maxSpendPerTx, dailySpendLimit, maxTxPerWindow, txWindowSeconds, validUntil, nonce
                )
            )
        );
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    /// @notice Register a delegation the user's main wallet has signed.
    /// @dev `user` is a parameter rather than `msg.sender` on purpose: the
    ///      whole point of the design is that the *agent* submits the grant
    ///      and pays the gas, so the user signs once and then walks away. The
    ///      signature is the authority, so a relayer cannot alter a field —
    ///      any edit changes the digest and the recovery fails.
    function registerDelegation(DelegationTerms calldata t, bytes calldata signature) external {
        if (t.user == address(0) || t.agent == address(0) || t.sessionKey == address(0)) revert ZeroAddress();
        if (t.validUntil <= block.timestamp) revert ValidityInThePast(t.validUntil, block.timestamp);
        if (t.maxTxPerWindow == 0 || t.txWindowSeconds == 0) {
            revert InvalidRateLimit(t.maxTxPerWindow, t.txWindowSeconds);
        }
        if (nonceUsed[t.user][t.nonce] || t.nonce != userNonce[t.user]) {
            if (nonceUsed[t.user][t.nonce]) revert NonceAlreadyUsed(t.user, t.nonce);
            revert InvalidNonce(userNonce[t.user], t.nonce);
        }

        // A user delegating to themselves grants nothing and only muddies the
        // audit trail.
        if (t.agent == t.user || t.sessionKey == t.user) revert SelfDelegation();

        _requireValidSignature(_termsDigest(t), t.user, signature);

        Delegation storage existing = _delegations[t.sessionKey];
        // S-1: Rebinding an existing session key to a different user is refused outright,
        // even if the previous delegation was revoked.
        if (existing.exists && existing.user != t.user) {
            revert SessionKeyAlreadyBound(t.sessionKey, existing.user);
        }

        // S-2: If the session key already exists and is frozen, revert!
        // An agent must NOT be able to unfreeze itself by submitting a backup signature.
        if (existing.exists && existing.frozen) {
            revert DelegationIsFrozen(t.sessionKey);
        }

        nonceUsed[t.user][t.nonce] = true;
        userNonce[t.user]++;

        // S-3: When re-registering an existing session key, retain both the
        // spend window and the frequency window, so re-signing cannot be used
        // to reset either counter.
        Delegation storage d = _delegations[t.sessionKey];
        if (!existing.exists) {
            d.windowStart = block.timestamp;
            d.txWindowStart = block.timestamp;
            d.spentInWindow = 0;
            d.txInWindow = 0;
            d.frozen = false;
        }
        d.user = t.user;
        d.agent = t.agent;
        d.sessionKey = t.sessionKey;
        d.maxSpendPerTx = t.maxSpendPerTx;
        d.dailySpendLimit = t.dailySpendLimit;
        d.maxTxPerWindow = t.maxTxPerWindow;
        d.txWindowSeconds = t.txWindowSeconds;
        d.validUntil = t.validUntil;
        d.nonce = t.nonce;
        d.exists = true;
        d.revoked = false;

        emit DelegationRegistered(
            t.user,
            t.agent,
            t.sessionKey,
            t.maxSpendPerTx,
            t.dailySpendLimit,
            t.maxTxPerWindow,
            t.txWindowSeconds,
            t.validUntil,
            t.nonce
        );
    }

    function _termsDigest(DelegationTerms calldata t) private view returns (bytes32) {
        return delegationDigest(
            t.user,
            t.agent,
            t.sessionKey,
            t.maxSpendPerTx,
            t.dailySpendLimit,
            t.maxTxPerWindow,
            t.txWindowSeconds,
            t.validUntil,
            t.nonce
        );
    }

    function _requireValidSignature(bytes32 digest, address expectedSigner, bytes calldata signature) private pure {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);

        // High-s and non-canonical v are refused: without this, `(r, s, v)` and
        // `(r, n - s, v ^ 1)` both recover the same address.
        if (uint256(s) > SECP256K1N_DIV_2) revert SignatureMalleable();
        if (v != 27 && v != 28) revert InvalidSignature();

        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != expectedSigner) revert InvalidSignature();
    }

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    /// @notice Authorise a module to charge delegations without being the agent.
    /// @dev Why this exists rather than loosening the caller check: on the perp
    ///      path the *manager contract* is the one that must move the counter,
    ///      because the manager is what knows a position was actually opened.
    ///      The agent cannot charge itself after the fact — that would be a
    ///      caller asserting its own spend succeeded, which is exactly what the
    ///      registry exists to prevent. So the consumer is named explicitly, by
    ///      the registry's owner, and only this one address gets the privilege.
    ///
    ///      The designated consumer is expected to be a contract — on this
    ///      repository it is `PositionManager`, which is the only party that
    ///      knows a position actually opened. It gets exactly one new power:
    ///      calling `chargeSpend`, which applies the same caps `authorizeSpend`
    ///      does. It does not get to act as the agent, and it cannot move funds,
    ///      because this registry never holds any.
    ///
    ///      Setting it to zero disables the module path again.
    function setSpendConsumer(address consumer) external onlyOwner {
        spendConsumer = consumer;
        emit SpendConsumerSet(consumer);
    }

    // ---------------------------------------------------------------------
    // Spending
    // ---------------------------------------------------------------------

    /// @notice Authorise one spend against a session key's delegation.
    /// @dev Callable by the delegated agent, by the user who granted it, or by
    ///      the module named in `spendConsumer` (see `setSpendConsumer` for why
    ///      that third caller is named explicitly rather than assumed). Anyone
    ///      else is refused, so a passer-by cannot burn a user's daily window
    ///      with junk calls.
    ///
    ///      The window is a rolling 24 hours anchored at the delegation's start
    ///      (or at the first spend after the previous window closed). It
    ///      *resets* — which the RFC's Redis version did not. That omission is
    ///      GAP-21: `daily_spent` never came back down, so a user hit their cap
    ///      exactly once and permanently.
    function authorizeSpend(address sessionKey, uint256 amount) external returns (bool) {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.revoked) revert DelegationIsRevoked(sessionKey);

        // The agent bills itself here. The user may too — the principal can
        // always exercise its own permission. A *third-party* module does not
        // come through this function; it uses `chargeSpend`, which is the only
        // entry that `spendConsumer` unlocks. Keeping the two separate is what
        // stops "the consumer may charge" from quietly becoming "the consumer
        // may charge while pretending to be the agent".
        if (msg.sender != d.agent && msg.sender != d.user) revert NotAuthorizedCaller(msg.sender);

        return _charge(sessionKey, amount);
    }

    /// @notice Charge a delegation from the designated consuming module.
    /// @dev The agent path cannot use `authorizeSpend` when a contract is the
    ///      one that knows the action happened. On the perp path the manager is
    ///      that contract: it must move the counter *after* a position actually
    ///      opened, and it cannot be the agent, because the agent is an EOA.
    ///
    ///      So the owner names one module, and that module — and only it — may
    ///      charge. The caps themselves are still applied by `_charge`, in one
    ///      place, so a consumer cannot charge past a limit that `authorizeSpend`
    ///      would have refused. Two entry points, one rule.
    function chargeSpend(address sessionKey, uint256 amount) external returns (bool) {
        if (msg.sender != spendConsumer || spendConsumer == address(0)) revert NotAuthorizedCaller(msg.sender);
        return _charge(sessionKey, amount);
    }

    /// @dev The single place spend rules are applied, whatever the caller.
    function _charge(address sessionKey, uint256 amount) private returns (bool) {
        if (amount == 0) revert ZeroAmount();

        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.revoked) revert DelegationIsRevoked(sessionKey);

        // Freeze is checked before expiry so the caller sees the more specific
        // reason.
        if (d.frozen) revert DelegationIsFrozen(sessionKey);
        if (block.timestamp > d.validUntil) revert DelegationExpired(sessionKey, d.validUntil);

        if (amount > d.maxSpendPerTx) revert ExceededPerTxLimit(amount, d.maxSpendPerTx);

        // Frequency limit: roll the tx window forward if it has closed, then
        // refuse once the window's allowance of spends is used up.
        if (block.timestamp >= d.txWindowStart + d.txWindowSeconds) {
            d.txWindowStart = block.timestamp;
            d.txInWindow = 0;
        }
        if (d.txInWindow >= d.maxTxPerWindow) {
            revert ExceededRateLimit(d.txInWindow, d.maxTxPerWindow, d.txWindowSeconds);
        }

        // Roll the window forward if the previous one has closed.
        if (block.timestamp >= d.windowStart + ONE_DAY) {
            d.windowStart = block.timestamp;
            d.spentInWindow = 0;
        }

        if (d.spentInWindow + amount > d.dailySpendLimit) {
            revert ExceededDailyLimit(amount, d.spentInWindow, d.dailySpendLimit);
        }

        d.spentInWindow += amount;
        d.txInWindow += 1;

        emit SpendAuthorized(sessionKey, msg.sender, amount, d.spentInWindow);
        return true;
    }

    // ---------------------------------------------------------------------
    // Revocation and circuit breaker
    // ---------------------------------------------------------------------

    /// @notice Kill a delegation. Only the granting user.
    /// @dev Revocation sticks: `registerDelegation` refuses a reused nonce, and
    ///      userNonce is incremented so old/backup signatures cannot revive the delegation.
    function revoke(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender) revert NotAuthorizedCaller(msg.sender);

        d.revoked = true;
        userNonce[msg.sender]++;
        emit DelegationRevoked(msg.sender, sessionKey);
    }

    /// @notice Invalidate the current user nonce so pending/backup signatures cannot be used.
    function invalidateNonce(address user) external {
        if (msg.sender != user) revert NotAuthorizedCaller(msg.sender);
        userNonce[user]++;
        emit NonceInvalidated(user, userNonce[user]);
    }

    /// @notice Freeze a session key without destroying the grant.
    /// @dev The off-chain module has the same switch (`FreezeSessionKey`) for
    ///      the same reason: when an agent looks compromised, stopping it now
    ///      and deciding later beats revoking and re-signing under pressure.
    ///      The owner can freeze too, so a circuit breaker does not depend on
    ///      the user being reachable.
    function freeze(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender && msg.sender != owner) revert NotAuthorizedCaller(msg.sender);

        d.frozen = true;
        emit SessionKeyFrozen(sessionKey, msg.sender);
    }

    function unfreeze(address sessionKey) external {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) revert NoSuchDelegation(sessionKey);
        if (d.user != msg.sender && msg.sender != owner) revert NotAuthorizedCaller(msg.sender);

        d.frozen = false;
        emit SessionKeyUnfrozen(sessionKey, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getDelegation(address sessionKey) external view returns (Delegation memory) {
        return _delegations[sessionKey];
    }

    /// @notice Would `authorizeSpend(sessionKey, amount)` succeed right now?
    /// @dev Deliberately a separate read rather than a dry-run of the write:
    ///      the front end needs to disable a button *before* the click, not
    ///      learn the refusal from a reverted transaction.
    function isAuthorized(address sessionKey, uint256 amount) external view returns (bool) {
        if (amount == 0) return false;

        Delegation storage d = _delegations[sessionKey];
        if (!d.exists || d.revoked || d.frozen) return false;
        if (block.timestamp > d.validUntil) return false;
        if (amount > d.maxSpendPerTx) return false;

        // Mirror the roll the write path would perform, without performing it.
        if (_txInCurrentWindow(d) >= d.maxTxPerWindow) return false;

        uint256 spent = block.timestamp >= d.windowStart + ONE_DAY ? 0 : d.spentInWindow;
        return spent + amount <= d.dailySpendLimit;
    }

    /// @notice How many more spends the frequency limit allows in the current window.
    function remainingTxInWindow(address sessionKey) external view returns (uint256) {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists || d.revoked || d.frozen) return 0;

        uint256 used = _txInCurrentWindow(d);
        return d.maxTxPerWindow > used ? d.maxTxPerWindow - used : 0;
    }

    /// @notice Unix time at which the current frequency window closes and the
    ///         spend count resets. Zero when there is no delegation.
    function txWindowResetsAt(address sessionKey) external view returns (uint256) {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists) return 0;
        return d.txWindowStart + d.txWindowSeconds;
    }

    /// @dev Spends counted against the frequency limit right now, mirroring the
    ///      roll `_charge` would perform without performing it.
    function _txInCurrentWindow(Delegation storage d) private view returns (uint256) {
        return block.timestamp >= d.txWindowStart + d.txWindowSeconds ? 0 : d.txInWindow;
    }

    /// @notice The user who granted this session key its authority.
    /// @dev `address(0)` when there is no delegation. Exposed as a narrow view
    ///      rather than having consumers read `getDelegation` and pick fields
    ///      out: `PositionManager` needs exactly this pair, and a consumer that
    ///      reaches into the struct is a consumer that breaks when the struct
    ///      changes. See `ISessionKeyRegistry`.
    function delegationOwner(address sessionKey) external view returns (address) {
        return _delegations[sessionKey].user;
    }

    /// @notice The agent the user named in the delegation.
    /// @dev `address(0)` when there is no delegation.
    function delegationAgent(address sessionKey) external view returns (address) {
        return _delegations[sessionKey].agent;
    }

    /// @notice Remaining allowance in the current window.
    function remainingDailyAllowance(address sessionKey) external view returns (uint256) {
        Delegation storage d = _delegations[sessionKey];
        if (!d.exists || d.revoked || d.frozen) return 0;

        uint256 spent = block.timestamp >= d.windowStart + ONE_DAY ? 0 : d.spentInWindow;
        return d.dailySpendLimit > spent ? d.dailySpendLimit - spent : 0;
    }
}
