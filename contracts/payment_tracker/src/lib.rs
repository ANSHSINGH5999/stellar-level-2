#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const COUNT_KEY: Symbol = symbol_short!("COUNT");

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentRecord {
    pub from: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub memo: Symbol,
}

#[contract]
pub struct PaymentTracker;

#[contractimpl]
impl PaymentTracker {
    /// Record a payment on-chain. Requires the `from` address to authorize.
    /// Returns the new total payment count.
    pub fn record_payment(env: Env, from: Address, amount: i128, memo: Symbol) -> u32 {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let count: u32 = env
            .storage()
            .instance()
            .get(&COUNT_KEY)
            .unwrap_or(0u32);

        let record = PaymentRecord {
            from: from.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
            memo,
        };

        // Store indexed by count
        env.storage().instance().set(&count, &record);

        let new_count = count + 1;
        env.storage().instance().set(&COUNT_KEY, &new_count);

        // Update user running total
        let user_total: i128 = env
            .storage()
            .persistent()
            .get(&from)
            .unwrap_or(0i128);
        env.storage()
            .persistent()
            .set(&from, &(user_total + amount));

        new_count
    }

    /// Returns the total number of payments recorded across all users.
    pub fn get_payment_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&COUNT_KEY)
            .unwrap_or(0u32)
    }

    /// Returns the total amount recorded for a specific user (in stroops).
    pub fn get_user_total(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&user)
            .unwrap_or(0i128)
    }

    /// Returns a payment record by its index (0-based).
    pub fn get_payment(env: Env, index: u32) -> Option<PaymentRecord> {
        env.storage().instance().get(&index)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_record_and_read() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(PaymentTracker, ());
        let client = PaymentTrackerClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let memo = symbol_short!("test");

        let count = client.record_payment(&user, &1000, &memo);
        assert_eq!(count, 1);
        assert_eq!(client.get_payment_count(), 1);
        assert_eq!(client.get_user_total(&user), 1000);

        let count2 = client.record_payment(&user, &500, &memo);
        assert_eq!(count2, 2);
        assert_eq!(client.get_user_total(&user), 1500);
    }

    #[test]
    fn test_get_payment() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(PaymentTracker, ());
        let client = PaymentTrackerClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let memo = symbol_short!("pay");

        client.record_payment(&user, &2000, &memo);

        let record = client.get_payment(&0).unwrap();
        assert_eq!(record.amount, 2000);
        assert_eq!(record.from, user);
    }
}
