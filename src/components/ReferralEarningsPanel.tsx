import React,{useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,CalendarDays,CheckCircle2,Clock3,RefreshCw,Send,TrendingUp,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string};
type ReferralWallet={id:string;balance_iqd:number};
type ReferralTx={id:string;type:string;amount_iqd:number;description:string|null;created_at:string};
type ReferralEarning={id:string;order_id:string;earning_iqd:number;base_amount_iqd:number;commission_percent:number;status:string;earned_at:string|null;created_at:string};
type ReferralSummary={balance_iqd:number;total_earned_iqd:number;monthly_earned_iqd:number;pending_iqd:number};
type WithdrawalRequest={id:string;user_id:string;amount_iqd:number;status:string;note:string|null;admin_note:string|null;requested_at:string;processed_at:string|null};

const txLabels:Record<string,string>={
 earning:'خەڵاتی Share',
 purchase:'کڕین بە خەڵاتی Share',
 withdrawal_reserve:'قازانج بۆ دەرکردن قەدەغە کرا',
 withdrawal_refund:'گەڕانەوەی قازانجی دەرنەکراو',
 withdrawal_payout:'پارەدانی دەرکراو'
};

const statusLabels:Record<string,string>={
 pending:'چاوەڕوان',
 earned:'حیسابکراو',
 cancelled:'هەڵوەشێنراوە',
 approved:'پەسەندکراو',
 rejected:'ڕەتکراوە'
};

const money=(value:number)=>Number(value||0).toLocaleString('en-US')+' د.ع';

export default function ReferralEarningsPanel({userId,role}:Props){
 const isAdmin=role==='admin'||role==='super_admin';
 const [wallet,setWallet]=useState<ReferralWallet|null>(null);
 const [summary,setSummary]=useState<ReferralSummary|null>(null);
 const [earnings,setEarnings]=useState<ReferralEarning[]>([]);
 const [transactions,setTransactions]=useState<ReferralTx[]>([]);
 const [requests,setRequests]=useState<WithdrawalRequest[]>([]);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [withdrawOpen,setWithdrawOpen]=useState(false);
 const [withdrawAmount,setWithdrawAmount]=useState('');
 const [withdrawNote,setWithdrawNote]=useState('');
 const [withdrawBusy,setWithdrawBusy]=useState(false);
 const [adminBusyId,setAdminBusyId]=useState('');

 const load=async()=>{
  setLoading(true);
  setMessage('');
  const [walletResult,summaryResult]=await Promise.all([
   supabase.from('referral_wallets').select('id,balance_iqd').eq('user_id',userId).maybeSingle(),
   supabase.rpc('get_referral_earnings_summary')
  ]);
  if(summaryResult.error){
   setSummary(null);
  }else{
   const row=Array.isArray(summaryResult.data)?summaryResult.data[0]:summaryResult.data;
   setSummary(row as ReferralSummary|null);
  }
  if(walletResult.error&&!String(walletResult.error.message||'').toLowerCase().includes('schema cache')){
   setMessage('نەتوانرا جزدانی خەڵاتی Shareەکان وەرگیرێت.');
  }
  setWallet(walletResult.data as ReferralWallet|null);

  const earningsResult=await supabase
   .from('order_referral_earnings')
   .select('id,order_id,earning_iqd,base_amount_iqd,commission_percent,status,earned_at,created_at')
   .eq('beneficiary_user_id',userId)
   .order('created_at',{ascending:false})
   .limit(40);
  if(!earningsResult.error)setEarnings((earningsResult.data||[]) as ReferralEarning[]);

  const txResult=walletResult.data
   ? await supabase.from('referral_wallet_transactions')
      .select('id,type,amount_iqd,description,created_at')
      .eq('wallet_id',walletResult.data.id)
      .order('created_at',{ascending:false})
      .limit(20)
   : {data:[],error:null} as any;
  if(!txResult.error)setTransactions((txResult.data||[]) as ReferralTx[]);

  const requestQuery=isAdmin
   ? supabase.from('referral_withdrawal_requests').select('id,user_id,amount_iqd,status,note,admin_note,requested_at,processed_at').order('requested_at',{ascending:false}).limit(30)
   : supabase.from('referral_withdrawal_requests').select('id,user_id,amount_iqd,status,note,admin_note,requested_at,processed_at').eq('user_id',userId).order('requested_at',{ascending:false}).limit(20);
  const requestResult=await requestQuery;
  if(!requestResult.error)setRequests((requestResult.data||[]) as WithdrawalRequest[]);
  if(walletResult.error&&walletResult.error.code!=='PGRST116')setMessage(walletResult.error.message||'هەڵەیەک ڕوویدا.');
  if(summaryResult.error&&!String(summaryResult.error.message||'').toLowerCase().includes('schema cache'))setMessage('نەتوانرا کۆی قازانج لە database هەژمار بکرێت.');
  setLoading(false);
 };

 useEffect(()=>{
  void load();
  const channel=supabase.channel('shakh-referral-wallet-'+userId)
   .on('postgres_changes',{event:'*',schema:'public',table:'referral_wallets',filter:'user_id=eq.'+userId},()=>{void load()})
   .on('postgres_changes',{event:'*',schema:'public',table:'order_referral_earnings',filter:'beneficiary_user_id=eq.'+userId},()=>{void load()})
   .on('postgres_changes',{event:'*',schema:'public',table:'referral_withdrawal_requests',...(isAdmin?{}:{filter:'user_id=eq.'+userId})},()=>{void load()})
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[userId,isAdmin]);

 const balance=Number(summary?.balance_iqd ?? wallet?.balance_iqd ?? 0);
 const monthlyEarnings=Number(summary?.monthly_earned_iqd||0);
 const totalEarned=Number(summary?.total_earned_iqd||0);
 const pending=Number(summary?.pending_iqd||0);

 const requestWithdrawal=async()=>{
  const amount=Number(withdrawAmount.replace(/\D/g,''));
  if(!Number.isFinite(amount)||amount<=0){setMessage('بڕی دەرکردن بە دروستی بنووسە.');return}
  if(amount>balance){setMessage('بڕی داواکراو لە باڵانسی قازانج زیاترە.');return}
  setWithdrawBusy(true);setMessage('');
  const{error}=await supabase.rpc('request_referral_withdrawal',{p_amount_iqd:amount,p_note:withdrawNote.trim()||null});
  setWithdrawBusy(false);
  if(error){setMessage(error.message.includes('INSUFFICIENT_REFERRAL_WALLET_BALANCE')?'باڵانسی قازانج بەس نییە.':error.message||'داواکاری دەرکردن سەرکەوتوو نەبوو.');return}
  setWithdrawOpen(false);setWithdrawAmount('');setWithdrawNote('');
  setMessage('داواکاری دەرکردنی قازانج نێردرا بۆ بەڕێوبەری شاخ.');
  await load();
 };

 const processWithdrawal=async(requestId:string,approve:boolean)=>{
  setAdminBusyId(requestId);setMessage('');
  const{error}=await supabase.rpc('process_referral_withdrawal',{p_request_id:requestId,p_approve:approve,p_admin_note:null});
  setAdminBusyId('');
  if(error){setMessage(error.message||'پرۆسەی داواکاری سەرکەوتوو نەبوو.');return}
  setMessage(approve?'داواکارییەکە پەسەند کرا.':'داواکارییەکە ڕەتکرایەوە و باڵانسەکە گەڕێندرایەوە.');
  await load();
 };

 if(loading)return <section className="referralEarningsPanel orderCard"><div className="walletLoading"><RefreshCw size={22}/> سیستەمی خەڵاتی Shareەکان بار دەکرێت...</div></section>;

 return <section className="referralEarningsPanel orderCard" aria-label="خەڵاتی Shareەکان">
  <div className="referralHead">
   <div>
    <span className="eyebrow"><TrendingUp size={15}/> خەڵاتی Shareەکان</span>
    <h2>قازانج لە بانگهێشتکردنی کڕیار</h2>
    <p>هەر کڕینێک کە لە لینکی Share ـی تایبەتی تۆوە بکرێت، خەڵاتی ئەو پۆستە بۆ حیسابی تۆ تۆمار دەکرێت.</p>
   </div>
   <button type="button" className="walletRefresh" onClick={()=>void load()} aria-label="نوێکردنەوە"><RefreshCw size={17}/></button>
  </div>

  <div className="referralHeroBalance">
   <div><small>باڵانسی قازانجی ئامادە</small><strong>{money(balance)}</strong><span>دەتوانرێت بۆ کڕینی شاخ بەکاربهێنرێت یان داوای دەرکردنی بکرێت.</span></div>
   <div className="referralHeroActions">
    <button type="button" className="primary" onClick={()=>{setWithdrawOpen(true);setMessage('')}} disabled={balance<=0}><Send size={16}/> داوای دەرکردن</button>
   </div>
  </div>

  <div className="referralStatsGrid">
   <div><CalendarDays size={18}/><span>قازانجی ئەم مانگە</span><b>{money(monthlyEarnings)}</b></div>
   <div><TrendingUp size={18}/><span>کۆی قازانجی حیسابکراو</span><b>{money(totalEarned)}</b></div>
   <div><Clock3 size={18}/><span>قازانجی چاوەڕوان</span><b>{money(pending)}</b></div>
  </div>

  <div className="referralSectionTitle"><span>دوایین قازانجەکان</span><b>{earnings.length.toLocaleString('ku-IQ')} تۆمار</b></div>
  {!earnings.length
   ?<div className="walletEmpty"><TrendingUp size={30}/><strong>هێشتا خەڵاتی Shareێکت نییە.</strong><small>کاتێک کڕیار لە لینکی Share ـی تۆوە بکڕێت و ئۆردەرەکە بگەیەنرێت، خەڵاتەکە لێرە دەردەکەوێت.</small></div>
   :<div className="referralEarningList">{earnings.slice(0,12).map(row=><div className="referralEarningRow" key={row.id}>
      <div className="referralEarningIcon"><ArrowDownLeft size={17}/></div>
      <div><b>{money(row.earning_iqd)}</b><small>ئۆردەر #{row.order_id.slice(0,8)} · {row.commission_percent}% · بنەما {money(row.base_amount_iqd)}</small></div>
      <span className={'referralStatus '+row.status}>{statusLabels[row.status]||row.status}</span>
    </div>)}</div>}

  <div className="referralSectionTitle"><span>داواکارییەکانی دەرکردن</span><b>{requests.length.toLocaleString('ku-IQ')} تۆمار</b></div>
  {!requests.length
   ?<div className="walletEmpty"><Send size={30}/><strong>هێشتا داواکارییەک نییە.</strong></div>
   :<div className="referralRequestList">{requests.slice(0,12).map(req=><div className="referralRequestRow" key={req.id}>
      <div><b>{money(req.amount_iqd)}</b><small>#{req.id.slice(0,8)} · {new Date(req.requested_at).toLocaleString('ku-IQ')}{isAdmin?' · بەکارهێنەر '+req.user_id.slice(0,8):''}</small></div>
      <span className={'referralStatus '+req.status}>{statusLabels[req.status]||req.status}</span>
      {isAdmin&&req.status==='pending'&&<div className="referralAdminActions">
       <button type="button" className="plain referralApprove" disabled={adminBusyId===req.id} onClick={()=>void processWithdrawal(req.id,true)}><CheckCircle2 size={15}/> پەسەند</button>
       <button type="button" className="plain referralReject" disabled={adminBusyId===req.id} onClick={()=>void processWithdrawal(req.id,false)}><X size={15}/> ڕەتکردنەوە</button>
      </div>}
    </div>)}</div>}

  {transactions.length>0&&<div className="referralSectionTitle"><span>جوڵەکانی جزدانی قازانج</span><b>دوایین ٢٠</b></div>}
  {transactions.length>0&&<div className="referralTxList">{transactions.map(tx=><div className="referralTxRow" key={tx.id}>
   <div className={'referralTxIcon '+(tx.type==='earning'||tx.type==='withdrawal_refund'?'positive':'negative')}>{tx.type==='earning'||tx.type==='withdrawal_refund'?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</div>
   <div><b>{txLabels[tx.type]||tx.type}</b><small>{tx.description||'مامەڵەی خەڵاتی Share'} · {new Date(tx.created_at).toLocaleString('ku-IQ')}</small></div>
   <strong className={tx.type==='earning'||tx.type==='withdrawal_refund'?'positive':'negative'}>{tx.type==='earning'||tx.type==='withdrawal_refund'?'+':'−'}{money(tx.amount_iqd)}</strong>
  </div>)}</div>}

  {message&&<div className="walletMessage" role="status" aria-live="polite">{message}</div>}

  {withdrawOpen&&<div className="referralModalBackdrop" role="presentation" onClick={()=>{if(!withdrawBusy)setWithdrawOpen(false)}}><div className="referralModal" role="dialog" aria-modal="true" aria-labelledby="referral-withdraw-title" onClick={e=>e.stopPropagation()}>
   <div className="referralModalHead"><div><span className="eyebrow">دەرکردنی قازانج</span><h3 id="referral-withdraw-title">داواکاریی دەرکردن بنێرە</h3><small>باڵانسی بەردەست: {money(balance)}</small></div><button type="button" className="plain" disabled={withdrawBusy} onClick={()=>setWithdrawOpen(false)} aria-label="داخستن"><X size={18}/></button></div>
   <label className="referralField"><span>بڕی قازانج</span><input inputMode="numeric" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value.replace(/\D/g,''))} placeholder="5000" /></label>
   <label className="referralField"><span>تێبینی</span><textarea rows={3} value={withdrawNote} onChange={e=>setWithdrawNote(e.target.value)} placeholder="بۆ کەی دەتەوێت دەرکرێت؟"/></label>
   <div className="referralModalFoot"><button type="button" className="plain" onClick={()=>setWithdrawOpen(false)} disabled={withdrawBusy}>پاشگەزبوونەوە</button><button type="button" className="primary" onClick={()=>void requestWithdrawal()} disabled={withdrawBusy||!withdrawAmount}>{withdrawBusy?'نێردراوە...':'ناردنی داواکاری'}</button></div>
  </div></div>}
 </section>;
}
