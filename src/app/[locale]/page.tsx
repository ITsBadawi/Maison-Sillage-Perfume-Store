import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import * as motion from 'motion/react-client';

export default function HomePage() {
  const t = useTranslations();
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{t('hero.eyebrow')}</p>
          <h1 id="hero-title">{t('hero.title')}</h1>
          <p className="hero-body">{t('hero.body')}</p>
          <div className="hero-actions"><Link href="/shop" className="button button-dark">{t('hero.primary')} <span aria-hidden="true">↗</span></Link><Link href="/advisor" className="text-link">{t('hero.secondary')} <span aria-hidden="true">↗</span></Link></div>
          <p className="hero-note"><span aria-hidden="true">✳</span> {t('hero.note')}</p>
        </div>
        <motion.div className="hero-art" role="img" aria-label={t('hero.artDescription')} initial={{opacity: 0}} animate={{opacity: 1}} transition={{duration: 0.7}}>
          <div className="sun-disc"/><div className="bottle-shadow"/><div className="perfume-bottle"><div className="bottle-cap"/><div className="bottle-neck"/><div className="bottle-glass"><span>MAISON<br/>SILLAGE</span></div></div>
          <span className="art-caption">EAU DE PARFUM <i>—</i> 01</span>
        </motion.div>
      </section>
      <section className="story" id="story">
        <div className="story-heading"><p className="eyebrow">{t('collection.eyebrow')}</p><h2>{t('collection.title')}</h2></div>
        <div className="story-detail"><p>{t('collection.body')}</p><div className="qualities"><span>01&nbsp; {t('collection.one')}</span><span>02&nbsp; {t('collection.two')}</span><span>03&nbsp; {t('collection.three')}</span></div></div>
      </section>
      <footer><span className="wordmark">MAISON <span>SILLAGE</span></span><p>{t('footer.line')}</p><small>{t('footer.copyright')}</small></footer>
    </main>
  );
}
