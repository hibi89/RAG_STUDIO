/** P5.21: separately authored synthetic bilingual retrieval evaluation; not external human gold.
 * Each topic has two intentionally distinct sources. Cross-language queries target the
 * opposite-language source, not a translated copy with an identical policy claim.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const original=fileURLToPath(new URL('../fixtures/ax_multi_doc_v0/',import.meta.url));
const rows=[
{
ko:'유제품 입고 후 냉장 창고의 온도를 매시간 기록하고 근무 교대자에게 전달한다.',
en:'Frozen seafood pallets must reach the freezer before noon and receive a blue security seal.',
ks:'유제품 창고 온도는 얼마마다 기록하나요?|냉장 원료의 온도 기록은 누가 전달하나요?|교대 근무자에게 넘기는 냉장 기록은?',
es:'When must seafood pallets enter the freezer?|What seal color is required for frozen fish?|Are seafood pallets stored before noon?',
ke:'냉동 수산물은 정오 전에 어디에 둬야 하나요?|얼린 생선 화물에 붙이는 봉인 색상은?|해산물 상자의 냉동 보관 마감 시점은?',
ek:'How frequently are dairy cold room temperatures logged?|Who gets the chilled milk temperature records?|What must be passed to the next shift for incoming dairy?'
},{
ko:'절단기의 보호 덮개를 열기 전에 작업자가 비상 정지 버튼을 눌러야 한다.',
en:'The hydraulic press reset key is locked inside the supervisor cabinet after each shift.',
ks:'절단기 보호막을 열 때 먼저 눌러야 하는 것은?|칼날 장비의 비상 정지 시점은?|절단 장치 덮개를 열기 전 작업 절차는?',
es:'Where is the hydraulic press reset key stored?|When is the press restart key locked away?|Which cabinet holds the hydraulic reset key?',
ke:'유압 프레스 재설정 열쇠는 교대 후 어디에 두나요?|압착기 초기화 키를 보관하는 잠긴 장소는?|교대가 끝난 프레스 재시동 열쇠의 관리자는?',
ek:'What is pressed before opening a cutting machine guard?|Should the cutter emergency stop be engaged first?|What action precedes lifting the cutter safety cover?'
},{
ko:'세금계산서 발행 오류는 회계 담당자가 월말 마감 전에 수정 이력을 남겨야 한다.',
en:'Supplier invoices above five thousand dollars require a second procurement signature.',
ks:'잘못 발행한 계산서의 수정 이력 담당자는?|세금계산서 오류 기록은 언제까지 남기나요?|월말 전에 고쳐야 하는 청구 문서의 기록은?',
es:'Who countersigns high-value supplier invoices?|At what amount is a second procurement signature required?|Do large vendor invoices need dual approval?',
ke:'오천 달러 초과 공급사 청구서에 추가로 서명하는 부서는?|고액 납품업체 대금 서류의 두 번째 결재자는?|구매 부서 서명 두 개가 필요한 금액 기준은?',
ek:'Who tracks tax invoice issuance corrections?|When should billing error history be logged?|What happens to incorrectly issued tax invoices before month-end?'
},{
ko:'현장 방문 예약 변경은 방문 하루 전 오후 세 시까지 담당자에게 알려야 한다.',
en:'Remote consultation appointments can be moved through the online portal without a support call.',
ks:'현장 방문 약속 변경의 통지 시한은?|출장 방문 전날 몇 시까지 알려야 하나요?|현장 예약 변경을 누구에게 요청하나요?',
es:'How can a remote consultation be rescheduled?|Do online advisory bookings require calling support?|What portal changes virtual consultation times?',
ke:'전화 없이 비대면 상담 일정을 바꾸는 수단은?|원격 자문 예약 시간을 변경하는 온라인 창구는?|상담원 통화 없이 비대면 약속을 옮길 수 있나요?',
ek:'How late can an on-site visit be rescheduled?|Who must be notified before a field appointment change?|What is the previous-day cutoff for a site visit change?'
},{
ko:'직원이 출입증을 잃어버리면 보안실에 즉시 신고하고 임시 출입 허가서를 발급받는다.',
en:'Guest badges must be returned to reception before the visitor exits the building.',
ks:'사원증을 잃으면 어디에 바로 신고하나요?|직원 출입증 분실 후 받는 임시 문서는?|보안실에 분실 신고하는 신분증은?',
es:'Where are guest passes returned on departure?|Must visitors hand badges back to reception?|When should guest entry passes be surrendered?',
ke:'외부인 명찰은 건물을 떠나기 전에 어디에 반납하나요?|손님용 출입 표지는 퇴실할 때 누구에게 돌려주나요?|방문객이 명찰을 가지고 그냥 나가도 되나요?',
ek:'What should an employee do after losing an access badge?|Where are missing staff cards reported?|What temporary permission replaces lost entry credentials?'
},{
ko:'깨진 유리 조각은 일반 쓰레기와 분리해 뚜껑이 있는 전용 통에 넣는다.',
en:'Expired batteries are collected once per week by a licensed hazardous-waste contractor.',
ks:'깨진 유리는 어느 쓰레기통에 버리나요?|유리 파편을 일반 폐기물과 함께 버려도 되나요?|유리 조각 보관 용기에 필요한 덮개는?',
es:'How often are depleted batteries collected?|Who picks up spent cells each week?|Does a certified contractor remove expired batteries?',
ke:'사용 기한 지난 건전지를 한 주마다 누가 수거하나요?|폐배터리 회수 업체에 필요한 면허는?|소모된 전지의 정기 수거 주기는?',
ek:'What container holds broken glass shards?|Can glass fragments go in ordinary rubbish?|Should broken glass be disposed of in a covered dedicated bin?'
},{
ko:'고객 거래 내역의 백업은 금요일마다 만들고 암호화된 외장장치에 저장한다.',
en:'Recovery snapshots are tested on the first Monday monthly by restoring a sample file.',
ks:'고객 거래기록은 어느 요일에 백업하나요?|거래 데이터 사본의 암호화 저장 장치는?|금요일마다 만드는 고객 정보 복제본은?',
es:'When are disaster recovery snapshots tested?|What file gets restored to validate a snapshot?|Is recovery validated on the first Monday of every month?',
ke:'재난 복구 스냅샷은 매달 첫 월요일에 어떻게 검사하나요?|복구 사본 확인을 위해 되살리는 대상 파일은?|매월 초에 하는 복원 스냅샷 점검은?',
ek:'On which day is transaction history backed up?|Where are encrypted customer record copies stored?|What protects the Friday backup of customer transactions?'
},{
ko:'입고 물품의 포장 손상은 검수자가 사진으로 기록한 다음 공급사에 알린다.',
en:'Warehouse aisle lighting is inspected at opening and broken fixtures receive orange tags.',
ks:'새로 들어온 물건의 포장이 찢어진 경우 증빙 방법은?|입고 상품 손상을 공급사에 알리는 담당자는?|검수자가 포장 불량을 기록하는 방식은?',
es:'When are warehouse aisle lights inspected?|What color tag marks broken warehouse lighting?|Are aisle fixtures checked at opening?',
ke:'창고 통로 전등은 언제 점검하나요?|고장 난 창고 조명에 붙이는 표식의 색은?|영업 시작에 확인하는 창고 통로 설비는?',
ek:'Who photographs damage to incoming packaging?|What evidence documents torn inbound shipment wrapping?|Which supplier is alerted about inbound packing damage?'
},{
ko:'견과류가 포함된 간식은 진열대 앞면에 알레르기 경고 표시를 붙인다.',
en:'Dairy-free meals are served using a separate purple tray to avoid cross-contact.',
ks:'견과 성분 간식의 알레르기 표시는 어느 쪽에 붙이나요?|땅콩 들어간 제품의 진열 안내 문구는?|견과류 과자 판매대에 경고 표지가 필요한 이유는?',
es:'What color tray is used for dairy-free meals?|How are non-dairy plates separated during service?|Which tray avoids cross-contact with dairy?',
ke:'유제품 없는 음식에 사용하는 쟁반 색깔은?|우유 성분을 뺀 식사 배식에 쓰는 분리 도구는?|유당이 없는 식단은 어떤 색 쟁반으로 내나요?',
ek:'Where are nut allergen notices placed on snack displays?|How should peanut-containing snacks be labeled?|Which face of the shelf carries the nut allergy warning?'
},{
ko:'분기 예산 조정 요청은 사업부장이 검토한 후 재무팀에 전자문서로 제출한다.',
en:'Emergency equipment purchases over ten thousand dollars need written operations director approval.',
ks:'분기 예산 수정 요청은 누가 먼저 검토하나요?|예산 조정 전자서류를 보내는 부서는?|사업부장 심사 이후 예산 문서를 제출하는 곳은?',
es:'Who signs off on emergency equipment purchases in writing?|What spending threshold needs operations director approval?|Do urgent purchases above ten thousand dollars need written approval?',
ke:'일만 달러 초과 긴급 장비 구매의 서면 결재자는?|비상 설비 고액 구매를 승인해야 하는 운영 책임자는?|고가의 긴급 기자재 구매 허가 금액 기준은?',
ek:'Who first reviews a quarterly budget adjustment?|Where is the electronic budget revision request submitted?|How is a division budget amendment routed after review?'
}
];
export const SCENARIOS=Object.freeze(rows);
const negatives=[
 '해왕성의 대기 메탄 함량은 얼마인가?','중성자별에서 관측되는 중력파 주파수는?',
 '목성의 위성들 중 화산이 활발한 곳은?','백악기 공룡의 서식지는 어디인가?',
 'How are extrasolar planets found by transit photometry?','What is the orbital period of an eclipsing binary?',
 'Explain the composition of lunar regolith.','Why do ocean tides respond to lunar gravity?',
 '성운에서 새로운 별이 탄생하는 과정은?','지구 자기장의 북극 이동 속도는?',
 'What causes a solar corona to reach extreme temperatures?','Describe the evolutionary history of coral reefs.'
];
export function authoredCases(){
 const out=[];
 for(let i=0;i<rows.length;i++){
  const code=String(i+1).padStart(2,'0'),entry=rows[i];
  for(const [family,source,raw] of [
   ['KO_SAME','document-ko-'+code,entry.ks],
   ['EN_SAME','document-en-'+code,entry.es],
   ['KO_TO_EN','document-en-'+code,entry.ke],
   ['EN_TO_KO','document-ko-'+code,entry.ek]
  ]){
   for(const [j,question] of raw.split('|').entries())
    out.push({id:family+'-'+code+'-'+j,family,question,expected:source});
  }
 }
 for(const [i,question] of negatives.entries())
  out.push({id:'NEG-'+String(i+1).padStart(2,'0'),family:'NEGATIVE',question,expected:null});
 return out;
}
export function createBilingualCorpus(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-p521-'));
 try{
  fs.copyFileSync(path.join(original,'sales.csv'),path.join(root,'sales.csv'));
  const manifest=JSON.parse(fs.readFileSync(path.join(original,'manifest.json'),'utf8'));
  manifest.project_id='synthetic-bilingual-eval';
  manifest.files=manifest.files.filter(x=>x.kind==='dataset');
  manifest.documents=[];
  for(let i=0;i<rows.length;i++){
   const code=String(i+1).padStart(2,'0');
   for(const [lang,body] of [['ko',rows[i].ko],['en',rows[i].en]]){
    const id='document-'+lang+'-'+code,fn=id+'.txt';
    const bytes=Buffer.from('[SYNTHETIC BENCHMARK]\n'+body+'\n','utf8');
    fs.writeFileSync(path.join(root,fn),bytes,{flag:'wx'});
    const file_id='file-'+lang+'-'+code;
    manifest.files.push({file_id,relative_path:fn,kind:'document',
      sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      size_bytes:bytes.length,import_status:'ACCEPTED'});
    manifest.documents.push({document_id:id,file_id,language:lang,
      source_title:'Synthetic '+code+' '+lang,page_info:'lines:1-2',index_status:'NOT_INDEXED'});
   }
  }
  manifest.processing_summary={accepted:manifest.files.length,needs_review:0,rejected:0,
    failed_file_ids:[],unsupported:[]};
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  return {root,close:()=>fs.rmSync(root,{recursive:true,force:true})};
 }catch(e){fs.rmSync(root,{recursive:true,force:true});throw e;}
}
