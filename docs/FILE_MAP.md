# خريطة الملفات البرمجية المخطط لها

هذه خريطة لما ينشأ أثناء التنفيذ، وليست قائمة ملفات موجودة حاليًا. كل ملفات التوثيق المشار إليها في README موجودة. نتجنب إنشاء ملفات كود فارغة تعطي انطباعًا كاذبًا بوجود تطبيق.

```text
project/
  AGENTS.md, README.md, ARCHITECTURE.md
  docs/                         # هذه الحزمة
  plans/ROADMAP.md, CURRENT_TASK.md
  .env.example, .gitignore
  package.json, package-lock.json
  tsconfig.json, next.config.ts, postcss.config.mjs
  eslint.config.mjs, components.json
  vitest.config.ts, playwright.config.ts
  vercel.json                   # إعداد العامل بعد اختيار الخطة
  src/
    app/
      [locale]/
        layout.tsx, loading.tsx, error.tsx, not-found.tsx
        (store)/
          page.tsx
          shop/page.tsx
          categories/[slug]/page.tsx
          products/[slug]/page.tsx
          advisor/page.tsx
          advisor/quiz/page.tsx
          advisor/results/[id]/page.tsx
          cart/page.tsx
          checkout/page.tsx
          checkout/success/[id]/page.tsx
          about/page.tsx, contact/page.tsx, shipping/page.tsx
          privacy/page.tsx, terms/page.tsx
        (auth)/auth/
          login/page.tsx, register/page.tsx, verify/page.tsx
          forgot-password/page.tsx, reset-password/page.tsx
        (account)/account/
          layout.tsx, page.tsx
          orders/page.tsx, orders/[id]/page.tsx
          favorites/page.tsx
        (admin)/admin/
          layout.tsx, page.tsx
          products/page.tsx, products/new/page.tsx
          products/[id]/edit/page.tsx
          inventory/page.tsx
          orders/page.tsx, orders/[id]/page.tsx
          coupons/page.tsx, quiz/page.tsx, staff/page.tsx
          settings/page.tsx, audit/page.tsx
      auth/callback/route.ts
      api/                      # route.ts لكل عقد في API_CONTRACTS
      robots.ts, sitemap.ts
    components/
      ui/                       # مكونات shadcn المستخدمة فقط
      layout/                   # header/footer/language switcher
      catalog/                  # product-card/gallery/note-pyramid
      advisor/                  # quiz-step/profile-bars/result-card
      checkout/                 # address-form/order-summary
      admin/                    # tables/product-form/status-actions
    features/
      catalog/queries.server.ts, schemas.ts
      cart/service.server.ts, schemas.ts, guest-cart.ts
      favorites/service.server.ts
      checkout/service.server.ts, money.ts, schemas.ts
      orders/service.server.ts, transitions.ts, schemas.ts
      inventory/service.server.ts, schemas.ts
      advisor/profile.ts, score.ts, filters.ts, schemas.ts
      advisor/service.server.ts, fallback.ts
      admin/service.server.ts, schemas.ts
      notifications/service.server.ts
    lib/
      supabase/client.ts, server.ts, privileged.server.ts
      auth/require-user.server.ts, require-role.server.ts
      integrations/gemini.server.ts, telegram.server.ts
      env.server.ts, rate-limit.server.ts, logger.server.ts
      quote-signature.server.ts, errors.ts
    i18n/routing.ts, request.ts, navigation.ts
    messages/ar.json, en.json
    styles/globals.css
    types/database.generated.ts
    proxy.ts                    # وفق إصدار Next.js المثبت
  supabase/
    config.toml
    migrations/                 # مولدة ومرقمة عند تنفيذ DB
    seed.sql                    # أو seed script واحد، لا مصدرين متناقضين
    tests/                      # RLS وRPC وقيود
  scripts/
    seed-demo.ts
    bootstrap-manager.ts
  tests/
    unit/money.test.ts, score.test.ts, transitions.test.ts
    integration/checkout.test.ts, roles.test.ts, outbox.test.ts
    e2e/customer.spec.ts, advisor.spec.ts, admin-roles.spec.ts
    fixtures/                   # قيم اختبار خيالية بلا credentials
  public/
    assets/products/, quiz/, brand/
    assets/ASSET_LICENSES.md
    audio/intro-crystal.*
  .github/workflows/ci.yml
```

## قواعد توضيحية

`(store)` و`(admin)` مجموعات تنظيم Next.js ولا تظهر في URL. مسار الإدارة الفعلي `/ar/admin` أو `/en/admin`. لا تنشئ locale layoutين متعارضين. callback مستقل ويحفظ locale عبر returnTo داخلي متحقق منه. Root layout في [locale] مع معالجة صحيحة للجذر وفق إعداد i18n.

قائمة API الدقيقة في [API_CONTRACTS](API_CONTRACTS.md) هي المرجع لملفات route.ts؛ لا تنشئ endpointين لنفس العملية. generated database types تنتج من schema الفعلي ولا تكتب يدويًا. لا ملف client عام يستورد privileged.server.ts.

النطاقات الصغيرة مثل favorites قد تبقى خدمة واحدة. تقسيم ملف عندما تتضح مسؤولية مستقلة، لا قاعدة «كل دالة ملف». يوجد مصدر seed واحد للمحتوى؛ seed.sql يمكن أن يقتصر على قيم تأسيسية، وseed-demo.ts للبيانات والأصول وحسابات العرض إذا استلزم Auth API.
