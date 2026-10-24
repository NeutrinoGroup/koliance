//! EIP-712 structured hash and delegation digest computation.
//! Bit-for-bit exact parity with `SessionKeyRegistry.sol`.

use ethnum::U256;
use tiny_keccak::{Hasher, Keccak};
use crate::types::DelegationTerms;

/// Computes standard Ethereum Keccak-256 hash.
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut keccak = Keccak::v256();
    let mut output = [0u8; 32];
    keccak.update(data);
    keccak.finalize(&mut output);
    output
}

/// EIP-712 Domain typehash for Koliance:
/// `keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")`
pub const DOMAIN_TYPE_STRING: &[u8] =
    b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

/// AgentDelegation struct typehash:
/// `keccak256("AgentDelegation(address user,address agent,address sessionKey,uint256 maxSpendPerTx,uint256 dailySpendLimit,uint256 maxTxPerWindow,uint256 txWindowSeconds,uint256 validUntil,uint256 nonce)")`
pub const AGENT_DELEGATION_TYPE_STRING: &[u8] =
    b"AgentDelegation(address user,address agent,address sessionKey,uint256 maxSpendPerTx,uint256 dailySpendLimit,uint256 maxTxPerWindow,uint256 txWindowSeconds,uint256 validUntil,uint256 nonce)";

/// Pads 20-byte address to 32 bytes according to ABI encoding rules (12 leading zero bytes).
#[inline(always)]
pub fn pad_address(addr: [u8; 20]) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[12..32].copy_from_slice(&addr);
    buf
}

/// Computes EIP-712 domain separator for `SessionKeyRegistry`.
pub fn build_domain_separator(chain_id: U256, verifying_contract: [u8; 20]) -> [u8; 32] {
    let domain_typehash = keccak256(DOMAIN_TYPE_STRING);
    let name_hash = keccak256(b"Koliance");
    let version_hash = keccak256(b"1");
    let contract_padded = pad_address(verifying_contract);

    let mut encoded = [0u8; 160];
    encoded[0..32].copy_from_slice(&domain_typehash);
    encoded[32..64].copy_from_slice(&name_hash);
    encoded[64..96].copy_from_slice(&version_hash);
    encoded[96..128].copy_from_slice(&chain_id.to_be_bytes());
    encoded[128..160].copy_from_slice(&contract_padded);

    keccak256(&encoded)
}

/// Computes the 32-byte `AgentDelegation` struct hash.
/// Bit-for-bit identical to `SessionKeyRegistry.hashDelegation`.
pub fn hash_delegation(terms: &DelegationTerms) -> [u8; 32] {
    let typehash = keccak256(AGENT_DELEGATION_TYPE_STRING);
    let user_padded = pad_address(terms.user);
    let agent_padded = pad_address(terms.agent);
    let session_key_padded = pad_address(terms.session_key);

    let mut encoded = [0u8; 320];
    encoded[0..32].copy_from_slice(&typehash);
    encoded[32..64].copy_from_slice(&user_padded);
    encoded[64..96].copy_from_slice(&agent_padded);
    encoded[96..128].copy_from_slice(&session_key_padded);
    encoded[128..160].copy_from_slice(&terms.max_spend_per_tx.to_be_bytes());
    encoded[160..192].copy_from_slice(&terms.daily_spend_limit.to_be_bytes());
    encoded[192..224].copy_from_slice(&U256::from(terms.max_tx_per_window).to_be_bytes());
    encoded[224..256].copy_from_slice(&U256::from(terms.tx_window_seconds).to_be_bytes());
    encoded[256..288].copy_from_slice(&U256::from(terms.valid_until).to_be_bytes());
    encoded[288..320].copy_from_slice(&U256::from(terms.nonce).to_be_bytes());

    keccak256(&encoded)
}

/// Computes the full EIP-712 digest to be signed by the user:
/// `keccak256("\x19\x01" || domainSeparator || structHash)`
pub fn delegation_digest(domain_separator: [u8; 32], struct_hash: [u8; 32]) -> [u8; 32] {
    let mut message = [0u8; 66];
    message[0] = 0x19;
    message[1] = 0x01;
    message[2..34].copy_from_slice(&domain_separator);
    message[34..66].copy_from_slice(&struct_hash);

    keccak256(&message)
}

/// Fast off-chain authorization check against delegation terms.
pub fn verify_delegation_limits(
    terms: &DelegationTerms,
    current_timestamp: u64,
    requested_spend: U256,
    spent_in_window: U256,
) -> Result<(), &'static str> {
    if terms.valid_until <= current_timestamp {
        return Err("Delegation has expired");
    }
    if requested_spend > terms.max_spend_per_tx {
        return Err("Requested spend exceeds maxSpendPerTx limit");
    }
    if spent_in_window + requested_spend > terms.daily_spend_limit {
        return Err("Requested spend exceeds dailySpendLimit allowance");
    }
    Ok(())
}
