/* Independent M1 customs calculation. Rates are versioned separately. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DomAvtoCustoms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class CalculationError extends Error { constructor(message, field) { super(message); this.name = 'CalculationError'; this.field = field; } }
  const gcd = (a,b) => { a=a<0n?-a:a; b=b<0n?-b:b; while(b) [a,b]=[b,a%b]; return a||1n; };
  class Decimal {
    constructor(n,d=1n) { if(!d) throw new Error('Division by zero'); if(d<0n) { n=-n;d=-d; } const g=gcd(n,d); this.n=n/g;this.d=d/g; }
    add(x) { x=dec(x);return new Decimal(this.n*x.d+x.n*this.d,this.d*x.d); }
    sub(x) { x=dec(x);return new Decimal(this.n*x.d-x.n*this.d,this.d*x.d); }
    mul(x) { x=dec(x);return new Decimal(this.n*x.n,this.d*x.d); }
    div(x) { x=dec(x);return new Decimal(this.n*x.d,this.d*x.n); }
    cmp(x) { x=dec(x);const n=this.n*x.d-x.n*this.d;return n<0n?-1:n>0n?1:0; }
    rounded(digits=2,halfEven=true) { const s=10n**BigInt(digits), n=this.n*s, sign=n<0n?-1n:1n, absolute=sign*n, q=absolute/this.d, remainder=absolute%this.d; return sign*(q+(remainder*2n>this.d || (remainder*2n===this.d&&(!halfEven||q%2n===1n))?1n:0n)); }
    number() { return Number(this.n)/Number(this.d); }
  }
  function dec(x) {
    if(x instanceof Decimal) return x;
    const s=String(x).trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^-?\d+(\.\d{1,12})?$/.test(s)) throw new CalculationError('Введите число без букв и лишних знаков.');
    const negative=s[0]==='-', parts=(negative?s.slice(1):s).split('.'), fraction=parts[1]||'';
    return new Decimal(BigInt(parts[0]+fraction)*(negative?-1n:1n),10n**BigInt(fraction.length));
  }
  const money = x => Number(dec(x).rounded(2))/100;
  const max = (a,b) => dec(a).cmp(b)>=0?dec(a):dec(b);
  const min = (a,b) => dec(a).cmp(b)<=0?dec(a):dec(b);
  function positive(value, field, label, maximum=1e10) {
    let x;try { x=dec(value); } catch { throw new CalculationError('Укажите '+label+'.',field); }
    if(x.cmp(0)<=0 || x.cmp(maximum)>0) throw new CalculationError('Проверьте '+label+': значение должно быть больше нуля.',field);
    return x;
  }
  function dateParts(s) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')) throw new CalculationError('Укажите дату расчёта курса.','rateDate');
    const [y,m,d]=s.split('-').map(Number); const date=new Date(Date.UTC(y,m-1,d));
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) throw new CalculationError('Проверьте дату.','rateDate');
    return {y,m,d,time:date.getTime()};
  }
  function ageAt(birth, onDate) {
    const a=dateParts(birth),b=dateParts(onDate); if(a.time>b.time) throw new CalculationError('Дата выпуска не может быть позже даты расчёта.','manufactured');
    const anniversary = years => {const end=new Date(Date.UTC(a.y+years,a.m,0)).getUTCDate();return Date.UTC(a.y+years,a.m-1,Math.min(a.d,end));};
    return {le3:b.time<=anniversary(3),lt3:b.time<anniversary(3),le5:b.time<=anniversary(5),le7:b.time<=anniversary(7)};
  }
  function ages(input,date) {
    if(input.manufactured) return ageAt(input.manufactured,date);
    if(!['new','35','57','7'].includes(input.age)) throw new CalculationError('Выберите возраст автомобиля.','age');
    return {le3:input.age==='new',lt3:input.age==='new',le5:['new','35'].includes(input.age),le7:input.age!=='7'};
  }
  function kw(power,unit) { return unit==='kw'?dec(power):dec(power).mul('0.7355'); }
  function powerIndex(power,limits) {
    // Published coefficients use kW with two decimal places; make the conversion policy explicit in the UI.
    const hundredths=dec(power).rounded(2,false);
    const i=limits.findIndex(v=>v===null || hundredths<=dec(v).rounded(2));
    if(i<0) throw new CalculationError('Не найдена ставка для мощности.'); return i;
  }
  function rateValue(currency, rates) {
    if(currency==='RUB') return dec(1);
    const r=rates.rates[currency];if(!r) throw new CalculationError('Нет курса выбранной валюты. Обновите курсы или введите курс вручную.','currency');
    return positive(r.value,'currencyRate','курс валюты',1e9).div(positive(r.nominal||1,'currencyRate','номинал валюты',1e9));
  }
  function calculate(input, data, rates) {
    const date=input.rateDate||rates.date; dateParts(date);
    if(date<data.validFrom||date>data.validUntil) throw new CalculationError('Таблицы проверены для 2026 года. Для выбранной даты нужны обновлённые ставки.','rateDate');
    if(!['personal','commercial'].includes(input.importer)) throw new CalculationError('Выберите, кто ввозит автомобиль.','importer');
    if(!['petrol','diesel','hybrid-petrol','hybrid-diesel','electric'].includes(input.engine)) throw new CalculationError('Выберите тип двигателя.','engine');
    if(!['hp','kw'].includes(input.powerUnit)) throw new CalculationError('Выберите единицу мощности.','powerUnit');
    const price=positive(input.price,'price','стоимость автомобиля',1e12);
    const p=positive(input.power,'power','мощность',10000);
    const age=ages(input,date), personal=input.importer==='personal', hybrid=input.engine.startsWith('hybrid-');
    const electric=input.engine==='electric'||(hybrid&&input.hybridType==='series');
    const diesel=input.engine==='diesel'||input.engine==='hybrid-diesel';
    const volume=electric?dec(0):positive(input.volume,'volume','точный объём двигателя в см³',100000);
    if(!electric&&volume.d!==1n) throw new CalculationError('Укажите объём в целых см³, например 1998.','volume');
    const currency=input.currency||'USD', currencyRate=rateValue(currency,rates), eur=rateValue('EUR',rates);
    const value=price.mul(currencyRate); if(value.cmp(1e12)>0) throw new CalculationError('Проверьте стоимость автомобиля и курс.','price');
    let utilizationKw=kw(p,input.powerUnit), iceDominant=input.iceDominant!==false;
    if(hybrid&&input.separatePowers) {
      const ip=positive(input.icePower,'icePower','мощность ДВС',10000), ep=positive(input.electricPower,'electricPower','30-минутную мощность электромоторов',10000);
      const ik=kw(ip,input.iceUnit||'hp'), ek=kw(ep,input.electricUnit||'hp');
      iceDominant=ik.cmp(ek)>0; utilizationKw=electric?ek:ik.add(ek);
    }
    const unified=personal&&!electric;
    let duty, dutyLabel, percent=null, minEuro=null;
    if(unified) {
      if(age.le3) {
        const row=data.personal.find(r=>r.maxEur===null||value.cmp(eur.mul(r.maxEur))<=0);
        percent=row.percent;minEuro=row.minEurPerCm3;
        duty=max(value.mul(percent).div(100),volume.mul(minEuro).mul(eur));
        dutyLabel=percent+'%, но не менее '+minEuro+' €/см³';
      } else {
        const row=data.personalVolume.find(r=>r.maxCm3===null||volume.cmp(r.maxCm3)<=0);
        minEuro=age.le5?row.eurPerCm3AgeGt3Le5:row.eurPerCm3AgeGt5;
        duty=volume.mul(minEuro).mul(eur);dutyLabel=minEuro+' €/см³';
      }
    } else if(electric || (hybrid&&!iceDominant)) {
      percent=15;duty=value.mul('0.15');dutyLabel='15%';
    } else if(age.lt3) {
      if(!diesel&&input.camper&&volume.cmp(1000)>0&&volume.cmp(3000)<=0) {
        minEuro=volume.cmp(1500)<=0?'0.6':'0.79';
        duty=min(value.mul('0.15'),max(value.mul('0.125'),volume.mul(minEuro).mul(eur)));
        dutyLabel='Кемпер: 12,5–15%, с минимумом '+minEuro+' €/см³';
      } else {
        percent=diesel||volume.cmp(2800)<=0?15:12.5;
        if(!diesel&&input.offroad) {if(volume.cmp(3500)<0)percent=15;else if(volume.cmp(4200)<=0)percent=12.5;else percent=10;}
        duty=value.mul(percent).div(100);dutyLabel=percent+'%';
      }
    } else {
      const row=(diesel?data.commercialDiesel:data.commercialPetrol).find(r=>r.maxCm3===null||volume.cmp(r.maxCm3)<=0);
      if(age.le7) {percent=row.percentAge3to7;minEuro=row.minEurPerCm3Age3to7;duty=max(value.mul(percent).div(100),volume.mul(minEuro).mul(eur));dutyLabel=percent+'%, но не менее '+minEuro+' €/см³';}
      else {minEuro=row.eurPerCm3AgeOver7;duty=volume.mul(minEuro).mul(eur);dutyLabel=minEuro+' €/см³';}
    }
    const fee=data.fee.find(r=>r.maxInclusiveRub===null||value.cmp(r.maxInclusiveRub)<=0).feeRub;
    const exciseRow=data.excise.find(r=>{const limit=input.powerUnit==='kw'?r.maxInclusiveKw:r.maxInclusiveHp;return limit===null||p.cmp(limit)<=0;});
    const exciseBase=input.powerUnit==='kw'?p.div('0.75'):p;
    const excise=unified?dec(0):exciseBase.mul(exciseRow.rateRubPerHP);
    const vat=unified?dec(0):value.add(duty).add(excise).mul(data.vatRate);
    const utilAge=age.le3?0:1, band=powerIndex(utilizationKw,electric?data.util.evKwMax:data.util.iceKwMax);
    const utilTable=electric?data.util.ev:data.util.ice.find(r=>r.maxCc===null||volume.cmp(r.maxCc)<=0);
    const qualifiesPersonal=personal&&input.personalConditions!==false;
    const coefficient=utilTable[qualifiesPersonal?'personal':'commercial'][band][utilAge];
    const commercialCoefficient=utilTable.commercial[band][utilAge];
    const util=dec(coefficient).mul(data.util.base), commercialUtil=dec(commercialCoefficient).mul(data.util.base);
    const payment=money(dec(fee).add(money(duty)).add(money(excise)).add(money(vat)));
    const result={date,currency,customsValue:money(value),priceEuro:value.div(eur).number(),currencyRate:currencyRate.number(),eurRate:eur.number(),unified,electric,
      duty:money(duty),dutyLabel,fee,excise:money(excise),exciseRate:unified?0:exciseRow.rateRubPerHP,
      exciseUnit:input.powerUnit==='kw'?'0,75 кВт':'1 л. с.',vat:money(vat),vatRate:data.vatRate,
      utilization:money(util),utilCoefficient:coefficient,commercialUtilization:money(commercialUtil),commercialUtilCoefficient:commercialCoefficient,
      utilizationKw:Number(utilizationKw.rounded(2,false))/100,customsPayments:payment,total:money(dec(payment).add(util)),
      resaleTotal:money(dec(payment).add(commercialUtil)),invoicePlusPayments:money(value.add(payment).add(util)),eaeu:false,notes:[]};
    if(hybrid) result.notes.push(electric?'Последовательная установка: в расчёте принята исключительно электрическая тяга. Подтвердите классификацию по документам.':'Для утильсбора обычного гибрида учитывается ДВС и 30-минутная мощность всех тяговых электромоторов.');
    if(input.eaeu) {
      result.eaeu=true;result.eaeuUndetermined=true;result.total=null;result.resaleTotal=null;result.invoicePlusPayments=null;
      if(input.eaeuReferenceConfirmed&&['referenceValue','paidDuty','paidVat','paidExcise'].every(k=>input[k]!==''&&input[k]!==undefined&&input[k]!==null)) {
        const referenceValue=positive(input.referenceValue,'referenceValue','нижнюю границу средней стоимости Минпромторга',1e12);
        const paid={};for(const k of ['paidDuty','paidVat','paidExcise']) {paid[k]=dec(input[k]);if(paid[k].cmp(0)<0)throw new CalculationError('Уплаченный платёж не может быть отрицательным.',k);}
        // The caller supplies the independently confirmed reference assessments from the declaration/rules.
        if(['referenceDuty','referenceVat','referenceExcise'].every(k=>input[k]!==''&&input[k]!==undefined&&input[k]!==null)) {
          let extra=dec(0);const components={};
          for(const [ref,paidKey]of [['referenceDuty','paidDuty'],['referenceVat','paidVat'],['referenceExcise','paidExcise']]) {
            const assessed=dec(input[ref]);if(assessed.cmp(0)<0)throw new CalculationError('Расчётный платёж не может быть отрицательным.',ref);
            components[ref]=money(max(0,assessed.sub(paid[paidKey])));extra=extra.add(components[ref]);
          }
          result.eaeuUndetermined=false;result.eaeuExtra=money(extra);result.eaeuComponents=components;
          result.eaeuReferenceValue=money(referenceValue);result.total=money(util.add(extra));result.resaleTotal=money(commercialUtil.add(extra));
        }
      }
      result.notes.push('Для уже выпущенного в ЕАЭС автомобиля показан базовый утиль и возможная доплата. Первичное оформление, пошлина, акциз и НДС не начисляются повторно.');
    }
    return result;
  }
  return {calculate,CalculationError,ageAt,Decimal,decimal:dec,money};
});
