# عقود واجهات الخادم

عقود الإصدار الأول، تُنفذ لاحقًا كـNext.js Route Handlers. جميعها JSON عبر HTTPS؛ language من locale ar/en المتحقق منه. money حقول decimal-string لوحدات صحيحة. المصادقة cookie والجلسة تتحقق على الخادم، وmutations تتحقق من Origin. لا CORS مفتوح.

## الاستجابة الموحدة

```json
{"ok":false,"error":{"code":"STOCK_CHANGED","messageKey":"checkout.stockChanged","fieldErrors":{}},"requestId":"opaque-id"}
```

200 قراءة/تعديل، 201 إنشاء، 400 بنية خاطئة، 401 غير مسجل، 403 غير مخول، 404 عنصر غير موجود أو غير مملوك، 409 تعارض، 422 قواعد عمل، 429 حد معدل، 503 عطل مؤقت. لا stack trace أو مفاتيح في الرد. `messageKey` يترجم في الواجهة.

## العميل

| الطريقة والمسار | المدخل | الرد والملاحظات |
|---|---|---|
| GET /api/catalog | q,category,family,season,occasion,gender,inStock,minPrice,maxPrice,page | published products فقط؛ page size 24، max query 100 حرف؛ DTO بلا كمية مخزون داخلية |
| GET /api/cart | لا شيء | سلة الحساب مع التسعير الحالي |
| PUT /api/cart/items | variantId,quantity | upsert كمية 1..10 |
| DELETE /api/cart/items/[variantId] | لا شيء | حذف من سلة المالك |
| POST /api/cart/merge | items[] | دمج الزائر بعد الدخول، جمع ثم cap مع رسالة عن التعديل |
| GET /api/favorites | لا شيء | مفضلة المالك |
| PUT /api/favorites/[productId] | لا شيء | إضافة idempotent |
| DELETE /api/favorites/[productId] | لا شيء | إزالة idempotent |
| POST /api/checkout/quote | items[{variantId,quantity}],shippingZoneId,couponCode? | subtotal,discount,shipping,total,currency,quoteHash؛ صلاحية عرض 5 دقائق |
| POST /api/orders | items,shippingZoneId,couponCode?,address,notes?,quoteHash | header Idempotency-Key UUID؛ 201 {orderId,publicNumber,totalMinor,currency,status} |
| GET /api/orders | page | طلبات المالك فقط |
| GET /api/orders/[id] | لا شيء | الطلب وبنوده وتاريخ حالاته للمالك فقط |
| PATCH /api/profile | fullName,phone,preferredLocale | لا يقبل role أو userId |

`address`: recipientName 2..100، phone بصيغة دولية بعد normalization، city 2..80، district 2..120، street 5..250، landmark اختياري ≤150. notes ≤500. لا تستخدم regex عراقيًا صارمًا إن دعم المتجر لاحقًا بلدًا آخر؛ رقم +964 مثال الديمو وليس افتراضًا لكل عميل.

`quoteHash` هنا token موقّع يحمل payload مُرمّزًا وتوقيعه، وليس hash عاريًا؛ يتضمن expiresAt ومعرف الحساب والعناصر والأسعار والشحن والكوبون والعملة. الخادم يوقعه HMAC باستخدام QUOTE_SIGNING_SECRET ويقارن التوقيع بأمان، ثم يعيد التسعير داخل المعاملة. إذا انتهت 5 دقائق أعد QUOTE_EXPIRED واطلب quote جديدًا. لا يحتفظ العميل بمفتاح التوقيع. استعادة طلب سبق إنشاؤه بنفس idempotency key وpayload تتم قبل رفض quote منتهٍ، حتى لا تضيع نتيجة طلب ناجح بسبب انقطاع الشبكة.

أخطاء العمل: PRICE_CHANGED، STOCK_CHANGED، COUPON_INVALID، COUPON_LIMIT_REACHED، QUOTE_EXPIRED، IDEMPOTENCY_CONFLICT، INVALID_ORDER_TRANSITION، VERSION_CONFLICT. لكل منها رسالة قابلة للفهم وخطوة استرداد واضحة.

## الاختبار

| الطريقة والمسار | المدخل | الرد |
|---|---|---|
| POST /api/advisor/sessions | locale | sessionId,quizVersion,questions؛ cookie ملكية للمجهول |
| PUT /api/advisor/sessions/[id]/answers | answers[{questionId,optionId}] | savedCount؛ جميع IDs ضمن نسخة الجلسة |
| POST /api/advisor/sessions/[id]/complete | لا شيء | recommendationId,status؛ يثبت الإجابات ويحسب مرة واحدة |
| GET /api/advisor/results/[id] | لا شيء | profile,items[{productId,variantId,score,explanation,available}],explanationSource |

إذا الشرح لم ينتهِ، يعاد `explanationStatus=pending` مع نتائج وقالب محلي صالح، وتستعلم الواجهة لفترة محدودة. لا polling بلا نهاية؛ حد 12 ثانية ثم fallback. التنفيذ الأبسط يكمل الاستدعاء المحدود في request complete نفسه ولا يحتاج queue ثانية. ملكية session/result لازمة؛ UUID وحده لا يكفي.

## الإدارة

| المسارات | الأدوار | العقد |
|---|---|---|
| GET/POST /api/admin/products، PATCH /[id] | القراءة لكل الموظفين؛ الكتابة manager/inventory_manager | محتوى ثنائي وvariants وnotes وvector؛ version للتعديل |
| POST /api/admin/products/[id]/archive | manager/inventory_manager | reason؛ لا حذف تاريخ الطلب |
| POST /api/admin/inventory/adjustments | manager/inventory_manager | variantId,delta,reason,eventKey,orderId? |
| GET /api/admin/orders، GET /[id] | manager/orders_manager | فلاتر حالة وتاريخ وترقيم |
| POST /api/admin/orders/[id]/transitions | manager/orders_manager | toStatus,expectedVersion,reason?,confirmCashCollected? |
| POST /api/admin/orders/[id]/notifications/retry | manager/orders_manager | يعيد pending فقط إن لم تكن processing/sent؛ إعادة sent تتطلب force وسبب |
| CRUD /api/admin/coupons | manager | تحقق المدة والحدود؛ تعطيل بدل حذف سجل مستخدم |
| CRUD /api/admin/quiz/drafts | manager | أسئلة/خيارات/mappings؛ لا تعديل نسخة منشورة |
| POST /api/admin/quiz/drafts/[id]/publish | manager | validate ثم publish ذري |
| GET/PATCH /api/admin/settings | manager | هوية ومناطق شحن وTelegram غير سري؛ token لا يقبل هنا |
| POST/PATCH /api/admin/staff | manager | دعوة موظف/دور/تعطيل؛ منع آخر Manager |
| POST /api/admin/media | manager/inventory_manager | رفع متحقق منه؛ object path وليس URL خارجيًا اعتباطيًا |
| GET /api/admin/audit | manager | سجل منقح بلا PII زائدة |
| GET /api/internal/notifications/dispatch | server cron فقط | Authorization Bearer CRON_SECRET؛ لا استدعاء متصفح |

CRUD اختصار للعقود التقليدية: POST create، GET list/detail، PATCH update، DELETE فقط draft غير مستخدم؛ في الكوبونات المستعملة يعادل التعطيل. لا تقبل mass assignment: قائمة حقول مسموحة لكل دور، وليس نسخ payload كاملًا إلى DB.
