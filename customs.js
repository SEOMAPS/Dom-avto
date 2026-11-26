(() => {
  'use strict';
  const $=id=>document.getElementById(id), form=$('customs-form');if(!form)return;
  const fmt=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
  const rub=n=>fmt.format(n)+' ₽';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const prettyDate=s=>s.split('-').reverse().join('.');
  const bool=id=>$(id).checked;
  let data,rates,rateVerified=false,rateSource='',lastResult=null,ready=false;
  $('rateDate').value=today();
  function invalidate() {
    lastResult=null;$('calc-result').hidden=true;$('calc-empty').hidden=false;
    $('empty-message').textContent='Данные изменены. Нажмите «Рассчитать платежи», чтобы получить новый результат.';
    $('calc-error').hidden=true;form.querySelectorAll('[aria-invalid]').forEach(n=>n.removeAttribute('aria-invalid'));
  }
  function sync() {
    const personal=form.elements.importer.value==='personal',hybrid=$('engine').value.startsWith('hybrid-');
    const electric=$('engine').value==='electric'||(hybrid&&$('hybridType').value==='series');
    $('personal-conditions-wrap').hidden=!personal;
    $('price-label').textContent=personal?'Стоимость автомобиля':'Таможенная стоимость';
    $('price-help').textContent=personal?'Цена по документам покупки. При личном ввозе доставка и страхование не включаются в стоимость для единой ставки.':'Укажите таможенную стоимость с расходами до границы ЕАЭС, которые включаются в неё по правилам оценки.';
    $('importer-help').textContent=personal?'Личный ввоз с расчётом по единым ставкам. Для электромобилей и последовательных гибридов применяются отдельные пошлина, акциз и НДС.':'Для юрлиц, ИП и ввоза не для личного пользования: пошлина по ЕТТ ЕАЭС, акциз, НДС 22% и полный утильсбор.';
    $('age').options[0].textContent=personal?'Не более 3 лет':'Менее 3 лет';
    $('age').options[1].textContent=personal?'Свыше 3 до 5 лет':'От 3 до 5 лет';
    $('age').disabled=!!$('manufactured').value;
    $('hybrid-type-wrap').hidden=!hybrid;$('hybrid-options').hidden=!hybrid;
    $('volume-wrap').hidden=electric;$('volume').disabled=electric;
    $('power-label').textContent=electric?'30-минутная мощность электромоторов':hybrid?'Мощность по документам':'Мощность двигателя';
    $('power-help').textContent=electric?'Сумма максимальных 30-минутных мощностей тяговых электромоторов из ЭПТС/СБКТС.':hybrid?'Для утиля укажите ДВС + 30-минутную мощность электромоторов либо заполните их отдельно ниже. Для акциза используется это поле.':'Укажите мощность по документам автомобиля.';
    $('component-powers').hidden=!bool('separatePowers');
    $('iceDominant').disabled=bool('separatePowers')||electric;
    $('manual-rate-fields').hidden=!bool('manualRates');
    $('rate-confirm-wrap').hidden=rateVerified||bool('manualRates');
    $('currency-rate-label').textContent='Рубли за 1 '+$('currency').value;
    $('currencyRate').disabled=['RUB','EUR'].includes($('currency').value);
    if($('currency').value==='EUR')$('currencyRate').value=$('eurRate').value;
    if($('currency').value==='RUB')$('currencyRate').value='1';
    $('eaeu-fields').hidden=!bool('eaeu');
    updateRateLine();
  }
  function rateNumber(currency) {const r=rates?.rates[currency];return currency==='RUB'?1:r?Number(r.value)/Number(r.nominal):NaN;}
  function updateRateLine() {
    if(!rates)return;
    const c=$('currency').value,n=rateNumber(c),eur=rateNumber('EUR');
    $('currency-line').textContent=`1 ${c} = ${Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:9}):'нет курса'} ₽ · 1 EUR = ${eur.toLocaleString('ru-RU',{maximumFractionDigits:9})} ₽`;
  }
  function populateCurrencies() {
    const selected=$('currency').value,priority=['USD','EUR','CNY','KRW','JPY','RUB'];
    const codes=[...priority,...Object.keys(rates.rates).filter(c=>!priority.includes(c)).sort()];
    $('currency').replaceChildren(...codes.filter(c=>rates.rates[c]).map(c=>{const o=document.createElement('option');o.value=c;o.textContent=c+' — '+rates.rates[c].name;return o;}));
    if(rates.rates[selected])$('currency').value=selected;
  }
  function fillManualRates() {
    const c=rateNumber($('currency').value),e=rateNumber('EUR');
    $('currencyRate').value=Number.isFinite(c)?String(c):'';$('eurRate').value=String(e);
  }
  function readInput() {
    const input={};
    for(const id of ['price','currency','volume','power','powerUnit','age','manufactured','engine','hybridType','icePower','electricPower','iceUnit','electricUnit','rateDate','referenceValue','referenceDuty','referenceVat','referenceExcise','paidDuty','paidVat','paidExcise'])input[id]=$(id).value.trim();
    for(const id of ['personalConditions','iceDominant','separatePowers','offroad','camper','eaeu','eaeuReferenceConfirmed'])input[id]=bool(id);
    input.importer=form.elements.importer.value;return input;
  }
  function selectedRates(input) {
    if(bool('manualRates'))return {date:input.rateDate,source:'Курсы введены вручную',rates:{[input.currency]:{value:$('currencyRate').value,nominal:1},EUR:{value:$('eurRate').value,nominal:1},RUB:{value:'1',nominal:1}}};
    if(input.rateDate!==today())throw new DomAvtoCustoms.CalculationError('Для другой даты включите ручной ввод и укажите действовавшие в этот день курсы ЦБ.','manualRates');
    if(!rateVerified&&!bool('rateConfirmed'))throw new DomAvtoCustoms.CalculationError('Актуальность резервных курсов не подтверждена. Обновите страницу или укажите курсы вручную.','manualRates');
    return rates;
  }
  function tableRow(label,rate,amount) {
    const tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');a.textContent=label;
    if(rate){const small=document.createElement('small');small.textContent=rate;a.append(small);}
    b.textContent=rub(amount);tr.append(a,b);return tr;
  }
  function render(result,input,usedRates) {
    $('calc-empty').hidden=true;$('calc-result').hidden=false;$('result-rows').replaceChildren();
    $('result-total').textContent=result.total===null?'Нужны данные по ЕАЭС':rub(result.total);
    $('result-caption').textContent=result.eaeu?'Утильсбор и доплата по ранее выпущенному автомобилю':'Таможенные платежи и утилизационный сбор';
    $('result-value').textContent=result.eaeu?'':'Стоимость для расчёта по курсу: '+rub(result.customsValue)+'.';
    const rows=$('result-rows');
    if(!result.eaeu) {
      rows.append(tableRow('Таможенное оформление','По таможенной стоимости',result.fee));
      rows.append(tableRow(result.unified?'Единая ставка пошлин и налогов':'Ввозная пошлина',result.dutyLabel,result.duty));
      if(!result.unified){rows.append(tableRow('Акциз',result.exciseRate+' ₽ / '+result.exciseUnit,result.excise));rows.append(tableRow('НДС','22% от стоимости, пошлины и акциза',result.vat));}
    }
    rows.append(tableRow('Утилизационный сбор','20 000 ₽ × '+result.utilCoefficient,result.utilization));
    if(result.eaeu&&!result.eaeuUndetermined)rows.append(tableRow('Доплата по ЕАЭС','Положительная разница по каждому платежу',result.eaeuExtra));
    $('resale-wrap').hidden=!(input.importer==='personal'&&result.resaleTotal!==null&&result.resaleTotal!==result.total);
    $('resale-total').textContent=result.resaleTotal===null?'':rub(result.resaleTotal);
    const notes=[...result.notes];
    if(result.eaeuUndetermined)notes.push('Базовый утиль показан отдельно. Итог появится после заполнения и подтверждения всех расчётных и уплаченных сумм по документам. Пустые поля не считаются нулевыми платежами.');
    if(result.unified)notes.push('НДС и акциз входят в единую ставку и отдельно не добавляются.');
    notes.push('Мощность для выбора утильсбора: '+result.utilizationKw.toLocaleString('ru-RU',{maximumFractionDigits:2})+' кВт.');
    notes.push('Доставка, услуги посредника, СБКТС, ЭПТС и регистрация не включены.');
    $('result-notes').replaceChildren(...notes.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
    const source=bool('manualRates')?'Введённые вручную курсы':rateSource;
    $('result-meta').textContent='Расчёт на '+prettyDate(input.rateDate)+'. Курсы от '+prettyDate(usedRates.date)+': '+source+'. Ставки: '+data.version+'.';
    lastResult={result,input,usedRates,source};
  }
  form.addEventListener('input',event=>{if(event.target.id==='manualRates'&&bool('manualRates'))fillManualRates();invalidate();sync();});
  form.addEventListener('change',event=>{if(event.target.id==='currency')fillManualRates();invalidate();sync();});
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!ready)return;
    try{const input=readInput(),used=selectedRates(input);const result=DomAvtoCustoms.calculate(input,data,used);$('calc-error').hidden=true;render(result,input,used);if(matchMedia('(max-width:1000px)').matches)$('calculation-summary').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
    catch(error){$('calc-error').textContent=error.message||'Проверьте исходные данные.';$('calc-error').hidden=false;const field=$(error.field);if(field){field.setAttribute('aria-invalid','true');field.focus();}}
  });
  $('copy-result').addEventListener('click',async()=>{
    if(!lastResult)return;
    const r=lastResult.result,i=lastResult.input;
    const lines=['Дом Авто — расчёт таможенных платежей',prettyDate(i.rateDate),`Стоимость: ${i.price} ${i.currency}`,`Тип: ${$('engine').selectedOptions[0].textContent}`,`Мощность: ${i.power} ${i.powerUnit==='kw'?'кВт':'л. с.'}`,r.eaeu?'Ранее выпущен в ЕАЭС':`Пошлина/единая ставка: ${rub(r.duty)}; оформление: ${rub(r.fee)}; акциз: ${rub(r.excise)}; НДС: ${rub(r.vat)}`,`Утиль: ${rub(r.utilization)}`,r.total===null?'Итог по ЕАЭС не определён':`Итого: ${rub(r.total)}`,`Курсы от ${prettyDate(lastResult.usedRates.date)}. ${lastResult.source}`, 'Предварительный расчёт; доставка и услуги не включены.','https://domavto56.ru/customs.html'];
    try{await navigator.clipboard.writeText(lines.join('\n'));$('copy-status').textContent='Расчёт скопирован.';}catch{$('copy-status').textContent='Копирование недоступно в этом браузере. Можно распечатать расчёт.';}
  });
  $('print-result').addEventListener('click',()=>{if(lastResult)window.print();});
  async function json(url,timeout=9000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,cache:'no-cache',credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
  function fromProvider(api) {
    const current=today(),apiDay=String(api.Date).slice(0,10),usePrevious=apiDay>current;
    const date=String(usePrevious?api.PreviousDate:api.Date).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>current||(Date.parse(current)-Date.parse(date)>14*86400000))throw new Error('Unusable rate date');
    const next={date,source:'https://www.cbr-xml-daily.ru/daily_json.js',rates:{RUB:{value:'1',nominal:1,name:'Российский рубль'}}};
    for(const [code,v]of Object.entries(api.Valute||{})){
      const value=usePrevious?v.Previous:v.Value;
      if(!/^[A-Z]{3}$/.test(code)||!Number.isFinite(value)||value<=0||!Number.isInteger(v.Nominal)||v.Nominal<=0)continue;
      next.rates[code]={value:String(value),nominal:v.Nominal,name:String(v.Name).slice(0,100)};
    }
    if(!next.rates.EUR||!next.rates.USD)throw new Error('Missing currencies');return next;
  }
  async function init() {
    try{
      [data,rates]=await Promise.all([json('customs-rates-2026.json'),json('customs-currencies.json')]);
      populateCurrencies();sync();
      try {rates=fromProvider(await json('https://www.cbr-xml-daily.ru/daily_json.js'));rateVerified=true;rateSource='ЦБ РФ через cbr-xml-daily.ru';}
      catch {rateVerified=rates.date===today();rateSource='Резервный набор, полученный с сайта ЦБ РФ';}
      populateCurrencies();fillManualRates();
      $('rate-status').textContent=(rateVerified?'Курсы на ':'Резервные курсы от ')+prettyDate(rates.date)+'. '+rateSource+(rateVerified?'.':'. Автоматически подтвердить актуальность не удалось.');
      sync();
      for(const source of data.sources){const li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.textContent=source.label;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('calc-sources-list').append(li);}
      ready=true;$('calc-submit').disabled=false;
    }catch{$('rate-status').textContent='Не удалось загрузить таблицы ставок. Обновите страницу: без них расчёт недоступен.';}
  }
  init();
})();
