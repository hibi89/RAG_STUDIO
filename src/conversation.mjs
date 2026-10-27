/** P5.17: bounded local follow-up. No LLM, prompt execution, generated SQL or persisted chat.
 * A previous answer is only a hint: source evidence is independently reloaded for every turn.
 */
import {routeQuestion} from './evidence-router.mjs';
const ELLIPSIS=/^(?:그건\s*며칠(?:이야|인가요)?|그럼\s*며칠(?:이야|인가요)?|그\s*기간은|그럼\s*몇\s*일(?:이야|인가요)?|몇\s*일(?:이야|인가요)?|그건\s*몇\s*일(?:이야|인가요)?)\s*[?？]?$/u;
const questionOk=x=>typeof x==='string'&&x.trim().length>0&&x.length<=500;
const abstain=(status,reason)=>({status,answer:null,reason,document_evidence:[],metric_evidence:null,
 conversation:{mode:'FOLLOWUP_ABSTAINED',resolved_question:null}});
export function answerFollowUp(root,question,previousQuestion){
 if(!questionOk(question)||!questionOk(previousQuestion))throw new Error('INVALID_FOLLOWUP_QUESTION');
 const current=question.trim();
 if(!ELLIPSIS.test(current))return abstain('NOT_SUPPORTED','Only explicit period follow-up wording is supported');
 // Validate previous claim and recheck every dataset/document source on the same current workspace.
 const previous=routeQuestion(root,previousQuestion);
 if(previous.status!=='ANSWERED'||!previous.requested)return abstain('CONTEXT_UNVERIFIED','Previous question has no verified answer');
 const {sales,returns,shipping}=previous.requested;
 if(sales||Number(Boolean(returns))+Number(Boolean(shipping))!==1)
   return abstain('AMBIGUOUS_CONTEXT','Previous question must ask exactly one supported document period');
 const rewritten=returns?'반품 신청 기간은?':'배송 준비 기간은?';
 const result=routeQuestion(root,rewritten);
 return {...result,conversation:{
   mode:result.status==='ANSWERED'?'SOURCE_RECHECKED_FOLLOWUP':'FOLLOWUP_ABSTAINED',
   resolved_question:result.status==='ANSWERED'?rewritten:null
 }};
}
