import React,{useEffect,useMemo,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,RefreshCw,WalletCards} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string};
type WalletRow={id:string;balance_iqd:number};
type Tx={id:string;type:'credit'|'debit'|'refund'|'commission'|'earning'|'withdrawal';amount_iqd:number;description:string|null;created_at:string};

const TYPE_LABELS:Record<Tx['type'],string>={
 credit:'زیادکردنی باڵانس',
 debit:'خەرجکردن',
 refund:'گەڕانەوەی پارە',
 commission:'کۆمیشن',
 earning:'داهات',
 withdrawal:'دەرهێنان'
};

const positiveTypes=new Set<Tx['type']>(['credit','refund','earning']);

export default function WalletPanel({userId}:Props){
 const [wallet,setWallet]=useState<WalletRow|null>(null);
 const [transactions,setTransactions]=useState<Tx[]>([]);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  setMessage('');
  const {data:walletData,error:walletError}=await supabase.from('wallets').select('id,balance_iqd').eq('user_id',userId).maybeSingle();
  if(walletError){setMessage('نەتوانرا زانیاریی جزدان وەرگیرێت.');setLoading(false);return;}
  setWallet(walletData as WalletRow|null);
  if(!walletData){setTransactions([]);setLoading(false);return;}
  const {data:txData,error:txError}=await supabase
   .from('wallet_transactions')
   .select('id,type,amount_iqd,description,created_at')
   .eq('wallet_id',walletData.id)
   .order('created_at',{ascending:false})
   .limit(20);
  if(txError){setMessage('باڵانس وەرگیرا، بەڵام مێژووی مامەڵەکان نەهات.');setTransactions([]);}
  else setTransactions((txData||[]) as Tx[]);
  setLoading(false);
 };

 useEffect(()=>{
  void load();
  const channel=supabase.channel('shakh-wallet-'+userId)
   .on('postgres_changes',{event:'*',schema:'public',table:'wallets',filter:'user_id=eq.'+userId},()=>{void load()})
   .on('postgres_changes',{event:'*',schema:'public',table:'wallet_transactions'},()=>{void load()})
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[userId]);

 const balance=Number(wallet?.balance_iqd||0);
 const stats=useMemo(()=>{
  const incoming=transactions.filter(tx=>positiveTypes.has(tx.type)).reduce((sum,tx)=>sum+Number(tx.amount_iqd||0),0);
  const outgoing=transactions.filter(tx=>!positiveTypes.has(tx.type)).reduce((sum,tx)=>sum+Number(tx.amount_iqd||0),0);
  return {incoming,outgoing};
 },[transactions]);

 if(loading)return <section className="walletPanel orderCard"><div className="walletLoading"><RefreshCw size={22}/> جزدان بار دەکرێت...</div></section>;

 return <section className="walletPanel orderCard" aria-label="جزدانی شاخ">
  <div className="walletHead">
   <div>
    <span className="eyebrow">جزدانی شاخ</span>
    <h2>پارە و مامەڵەکان</h2>
    <p>باڵانس و مێژووی جوڵەی جزدان لە داتابەیسی شاخ.</p>
   </div>
   <button type="button" className="walletRefresh" onClick={()=>void load()} disabled={loading} aria-label="نوێکردنەوەی جزدان"><RefreshCw size={17}/></button>
  </div>

  <div className="walletBalanceCard">
   <div className="walletBalanceIcon"><WalletCards size={24}/></div>
   <div>
    <small>باڵانسی ئێستا</small>
    <strong>{balance.toLocaleString('en-US')} د.ع</strong>
   </div>
  </div>

  <div className="walletMiniStats">
   <div><ArrowDownLeft size={18}/><span>هاتوو</span><b>{stats.incoming.toLocaleString('en-US')} د.ع</b></div>
   <div><ArrowUpRight size={18}/><span>چووەدەرەوە</span><b>{stats.outgoing.toLocaleString('en-US')} د.ع</b></div>
  </div>

  <div className="walletSectionTitle"><span>مێژووی مامەڵەکان</span><b>دوایین ٢٠ مامەڵە</b></div>
  {!wallet
   ? <div className="walletEmpty"><WalletCards size={30}/><strong>هێشتا جزدانێکت دروست نەکراوە.</strong><small>کاتێک جزدانەکە بۆ هەژمارەکەت دروست بکرێت، لێرە دەر دەکەوێت.</small></div>
   : !transactions.length
    ? <div className="walletEmpty"><WalletCards size={30}/><strong>هێشتا هیچ مامەڵەیەک نییە.</strong><small>جوڵەکانی جزدان لێرە نیشان دەدرێن.</small></div>
    : <div className="walletTransactions">
      {transactions.map(tx=>{
       const positive=positiveTypes.has(tx.type);
       return <div className="walletTx" key={tx.id}>
        <div className={positive?'walletTxIcon positive':'walletTxIcon negative'}>{positive?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</div>
        <div className="walletTxBody">
         <b>{TYPE_LABELS[tx.type]||'مامەڵە'}</b>
         <small>{tx.description||'مامەڵەی جزدان'} · {new Date(tx.created_at).toLocaleString('ku-IQ')}</small>
        </div>
        <strong className={positive?'positive':'negative'}>{positive?'+':'−'}{Number(tx.amount_iqd||0).toLocaleString('en-US')} د.ع</strong>
       </div>;
      })}
     </div>}
  {message&&<div className="walletMessage" role="status" aria-live="polite">{message}</div>}
 </section>;
}
