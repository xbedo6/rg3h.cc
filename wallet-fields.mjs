import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Loyalty=require('./dist/loyalty.js'),WalletLayout=require('./dist/wallet-layout.js');
export const WALLET_LAYOUT_VERSION='wallet-compatible-reward-v3';

// WalletWallet shares the field arrays between its classic and poster layouts.
// Classic primary fields cover the strip artwork. Poster footers stay below it,
// while secondary fields appear only on classic Apple and Google pass faces.
export function walletFields(card,member){
 const p=Loyalty.program(card),en=card.cardLanguage==='en',reward={label:en?'Reward':'المكافأة',value:String(WalletLayout.reward(card,p)||Loyalty.label(card)||'').slice(0,256)};
 const balance=p.type==='points'?member.points||0:member.stamps||0,target=p.type==='points'?p.pointsCost:card.target;
 return {
  primaryFields:[],
  secondaryFields:[{...reward}],
  footerFields:[{...reward}],
  headerFields:[{label:en?'BALANCE':'الرصيد',value:balance+' / '+target,changeMessage:en?'Your balance: %@':'رصيدك الآن: %@'}],
  rewardAvailability:{label:en?'AVAILABLE REWARDS':'مكافآت جاهزة',value:String(Loyalty.available(member,card))}
 };
}
