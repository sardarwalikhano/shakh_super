import { supabase } from './supabase';

export type Wallet = {
  user_id: string;
  balance_iqd: number;
  updated_at: string;
};

export async function getMyWallet() {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id,balance_iqd,updated_at')
    .single();
  if (error) throw error;
  return data as Wallet;
}

export async function getWalletTransactions() {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id,type,amount_iqd,description,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
