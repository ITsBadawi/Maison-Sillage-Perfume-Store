import {AdvisorExperience} from '@/components/advisor/advisor-experience';
import {getTranslations} from 'next-intl/server';

export default async function AdvisorPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'advisor'});
  const copy = {loading:t('loading'),loadError:t('loadError'),saveError:t('saveError'),retry:t('retry'),matching:t('matching'),noMatches:t('noMatches'),startOver:t('startOver'),newConsultation:t('newConsultation'),profile:t('profile'),back:t('back'),answersSaved:t('answersSaved'),available:t('available'),unavailable:t('unavailable'),notMeasured:t('notMeasured'),disclaimer:t('disclaimer'),question:t.raw('question'),scoreLabel:t.raw('scoreLabel')};
  return <main className="advisor-page"><header className="advisor-intro"><p className="eyebrow">MAISON SILLAGE · THE SCENT EDIT</p><h1>{t('title')}</h1><p>{t('intro')}</p></header><AdvisorExperience locale={locale === 'ar' ? 'ar' : 'en'} copy={copy} /></main>;
}
