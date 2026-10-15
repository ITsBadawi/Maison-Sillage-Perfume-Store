'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import Image from 'next/image';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Link} from '@/i18n/navigation';
import {formatCatalogPrice} from '@/features/catalog/format-price';

type Option = {id: string; label_ar: string; label_en: string};
type Question = {id: string; key: string; title_ar: string; title_en: string; hint_ar: string; hint_en: string; kind: string; options: Option[]};
type ResultItem = {productId: string; variantId: string; slug: string; nameAr: string; nameEn: string; imagePath: string | null; imageUrl: string | null; score: number; explanation: string; available: boolean; priceMinor: string};
type Result = {id: string; profile: {dimensions: Record<string, number | null>}; explanationSource: 'gemini' | 'fallback'; items: ResultItem[]};
type Copy = Record<'loading'|'loadError'|'saveError'|'retry'|'matching'|'noMatches'|'startOver'|'newConsultation'|'profile'|'back'|'answersSaved'|'available'|'unavailable'|'notMeasured'|'disclaimer'|'question'|'scoreLabel', string>;

const dimensionNames: Record<string, {ar: string; en: string}> = {
  woody:{ar:'خشبي',en:'Woody'}, floral:{ar:'زهري',en:'Floral'}, fresh:{ar:'منعش',en:'Fresh'}, sweet:{ar:'حلو',en:'Sweet'}, warm:{ar:'دافئ',en:'Warm'}, smoky:{ar:'دخاني',en:'Smoky'},
  bold:{ar:'جريء',en:'Bold'}, calm:{ar:'هادئ',en:'Calm'}, classic:{ar:'كلاسيكي',en:'Classic'}, modern:{ar:'عصري',en:'Modern'}, day:{ar:'نهاري',en:'Day'}, night:{ar:'مسائي',en:'Night'},
};

export function AdvisorExperience({locale, copy}: {locale: 'ar' | 'en'; copy: Copy}) {
  const ar = locale === 'ar';
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<'loading'|'ready'|'saving'|'results'|'error'|'empty'>('loading');
  const [message, setMessage] = useState('');
  const reducedMotion = useReducedMotion();
  const visibleQuestions = useMemo(() => questions, [questions]);
  const question = visibleQuestions[step];

  useEffect(() => {
    let active = true;
    fetch('/api/advisor/sessions', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({locale})})
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error?.code ?? 'unavailable'); return json.data; })
      .then((data) => { if (active) { setSessionId(data.sessionId); setQuestions(data.questions); setState('ready'); } })
      .catch(() => { if (active) { setState('error'); setMessage(copy.loadError); } });
    return () => { active = false; };
  }, [ar, copy.loadError, locale]);

  const complete = useCallback(async (nextAnswers: Record<string,string>) => {
    if (!sessionId) return;
    setState('saving'); setMessage('');
    try {
      const saved = await fetch(`/api/advisor/sessions/${sessionId}/answers`, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({answers:Object.entries(nextAnswers).map(([questionId,optionId])=>({questionId,optionId}))})});
      if (!saved.ok) throw new Error('save');
      const response = await fetch(`/api/advisor/sessions/${sessionId}/complete`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({locale})});
      const json = await response.json();
      if (!response.ok) {
        if (json.error?.code === 'no_matches') { setState('empty'); return; }
        throw new Error(json.error?.code ?? 'complete');
      }
      const resultResponse = await fetch(`/api/advisor/results/${json.data.recommendationId}`, {cache:'no-store'});
      const resultJson = await resultResponse.json();
      if (!resultResponse.ok) throw new Error('result');
      setResult(resultJson.data); setState('results');
    } catch {
      setState('error'); setMessage(ar ? 'تعذر حفظ إجاباتك. حاول مرة أخرى.' : 'We could not save your answers. Please try again.');
    }
  }, [ar, locale, sessionId]);

  async function choose(optionId: string) {
    if (!question) return;
    const next = {...answers, [question.id]: optionId};
    setAnswers(next);
    if (step < visibleQuestions.length - 1) {
      try {
        const response = await fetch(`/api/advisor/sessions/${sessionId}/answers`, {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({answers:Object.entries(next).map(([questionId,id])=>({questionId,optionId:id}))})});
        if (!response.ok) throw new Error('save');
        setStep(step + 1);
      } catch { setState('error'); setMessage(copy.saveError); }
    } else await complete(next);
  }

  if (state === 'loading') return <div className="advisor-panel" aria-live="polite">{copy.loading}</div>;
  if (state === 'error') return <section className="advisor-panel" role="alert"><p>{message || copy.saveError}</p><button className="advisor-button" onClick={() => location.reload()}>{copy.retry}</button></section>;
  if (state === 'empty') return <section className="advisor-panel"><p>{copy.noMatches}</p><button className="advisor-button" onClick={() => location.reload()}>{copy.startOver}</button></section>;
  if (state === 'saving') return <div className="advisor-panel" aria-live="polite">{copy.matching}</div>;
  if (result) return <section className="advisor-results">
    <div className="advisor-panel"><p className="eyebrow">{copy.profile}</p><div className="advisor-dna">{Object.entries(result.profile.dimensions).map(([key,value]) => <span key={key} className={!value && value !== 0 ? 'is-unset' : ''}>{ar ? dimensionNames[key]?.ar : dimensionNames[key]?.en}<b>{value === null ? copy.notMeasured : `${Math.round(value)}/100`}</b></span>)}</div></div>
    <div className="advisor-result-list">{result.items.map((item) => <article className="advisor-product" key={item.productId}>{item.imageUrl ? <Image className="advisor-product-image" src={item.imageUrl} width={72} height={96} unoptimized alt={ar ? item.nameAr : item.nameEn} /> : <div className="advisor-product-mark" aria-hidden="true">✳</div>}<div><p className="eyebrow">{copy.scoreLabel.replace('{score}',String(item.score))}</p><h2><Link href={`/products/${item.slug}`}>{ar ? item.nameAr : item.nameEn}</Link></h2><p>{item.explanation}</p><p className="advisor-stock">{item.available ? copy.available : copy.unavailable} · {formatCatalogPrice(item.priceMinor, locale)}</p></div></article>)}</div>
    <p className="advisor-disclaimer">{copy.disclaimer}</p>
    <button className="advisor-button" onClick={() => location.reload()}>{copy.newConsultation}</button>
  </section>;
  if (!question) return null;
  return <section className="advisor-quiz" aria-labelledby="advisor-question">
    <div className="advisor-progress"><span>{copy.question.replace('{current}',String(step+1)).replace('{total}',String(visibleQuestions.length))}</span><div><i style={{width:`${((step+1)/visibleQuestions.length)*100}%`}} /></div></div>
    <AnimatePresence initial={false} mode="wait"><motion.div key={question.id} className="advisor-panel"
      initial={reducedMotion ? false : {opacity:0, y:12}}
      animate={{opacity:1, y:0}}
      exit={reducedMotion ? undefined : {opacity:0, y:-8}}
      transition={{duration:reducedMotion ? 0 : 0.28, ease:'easeOut'}}>
      <p className="eyebrow">MAISON SILLAGE · SCENT ADVISOR</p><h2 id="advisor-question">{ar ? question.title_ar : question.title_en}</h2>
      <div className="advisor-options" role="group" aria-labelledby="advisor-question">{question.options.map((option) => <button key={option.id} className="advisor-option" onClick={() => void choose(option.id)}>{ar ? option.label_ar : option.label_en}<span aria-hidden="true">{ar ? '←' : '→'}</span></button>)}</div>
    <div className="advisor-controls"><button className="advisor-back" disabled={step===0} onClick={()=>setStep(Math.max(0,step-1))}>{copy.back}</button><span>{copy.answersSaved}</span></div>
    </motion.div></AnimatePresence>
  </section>;
}
