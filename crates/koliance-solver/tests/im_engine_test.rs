use koliance_solver::{ImSyncHub, channel_key};

#[test]
fn test_im_engine_basic_flow() {
    let mut hub = ImSyncHub::new(100);

    let sender = "0xUserAlice";
    let recipient = "0xUserBob";

    // 1. Ingest first message
    let msg1 = hub.ingest_message(sender, recipient, "TEXT", "Hello Bob!", 1000).expect("ingest message 1");
    assert_eq!(msg1.sender, "0xuseralice");
    assert_eq!(msg1.recipient, "0xuserbob");
    assert_eq!(msg1.content, "Hello Bob!");
    assert_eq!(hub.total_messages(), 1);

    // 2. Reject duplicate message (same sender, recipient, content, and timestamp)
    let dup_err = hub.ingest_message(sender, recipient, "TEXT", "Hello Bob!", 1000);
    assert!(dup_err.is_err(), "Duplicate message should be rejected");

    // 3. Ingest response from Bob
    let msg2 = hub.ingest_message(recipient, sender, "TEXT", "Hey Alice, what's up?", 1005).expect("ingest message 2");
    assert_eq!(msg2.sender, "0xuserbob");
    assert_eq!(hub.total_messages(), 2);

    // 4. Sync channel messages since timestamp 1002 (should only return msg2)
    let delta = hub.sync_channel(sender, recipient, 1002);
    assert_eq!(delta.len(), 1);
    assert_eq!(delta[0].id, msg2.id);

    // 5. Sync from beginning
    let all = hub.sync_channel(sender, recipient, 0);
    assert_eq!(all.len(), 2);
}

#[test]
fn test_im_greeting_with_confetti() {
    let mut hub = ImSyncHub::new(100);

    let sender = "alice@koliance.io";
    let recipient = "bob@koliance.io";

    let greeting = hub.create_greeting(sender, recipient, None, 2000).expect("create greeting packet");
    assert!(greeting.has_confetti, "Greeting packet must enable confetti flag");
    assert_eq!(greeting.greeting_text, "你好！很高兴在 Koliance 与你打招呼！");
    assert_eq!(hub.total_messages(), 1);
}

#[test]
fn test_im_channel_canonical_key() {
    let key1 = channel_key("0xAlice", "0xBob");
    let key2 = channel_key("0xBob", "0xAlice");
    assert_eq!(key1, key2, "Channel key must be symmetric regardless of sender/recipient order");
}
