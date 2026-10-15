# قاعدة البيانات

## قواعد عامة

PostgreSQL في Supabase. المخطط الآتي عقد تنفيذ تفصيلي، وليس migration منفذًا. `uuid` للمفاتيح ما لم يُذكر خلافه، `timestamptz` بتوقيت UTC للتواريخ، و`created_at/updated_at` للجداول القابلة للتعديل. العرض بتوقيت Asia/Baghdad افتراضيًا. جميع FK تُفهرس حيث تستخدم في الربط والسياسات. الحذف التاريخي `RESTRICT`؛ ربط الأطفال غير التاريخيين يسمح `CASCADE` عند الحاجة فقط.

الأموال `bigint` بوحدات العملة الصغرى مع `currency_code` و`currency_exponent`. للديمو IQD exponent=3: مبلغ 125,000 دينار يخزن 125,000,000 وحدة صغرى. كل الحسابات صحيحة بلا floating point؛ إرسال money في JSON كسلسلة رقمية لتفادي فقد الدقة. العرض قد يخفي الأصفار العشرية عندما تكون القيمة كاملة.

## الحسابات

| الجدول | الحقول الأساسية | القيود |
|---|---|---|
| profiles | id FK auth.users، full_name، phone، preferred_locale | id PK، locale ar/en؛ لا role هنا |
| staff_roles | user_id FK profiles، role، active، assigned_by | PK user_id؛ role manager/orders_manager/inventory_manager |
| favorites | user_id، product_id، created_at | PK(user_id,product_id) |
| carts | id، user_id | UNIQUE(user_id) |
| cart_items | cart_id، variant_id، quantity | PK(cart_id,variant_id)، quantity 1..10 |

الزائر يحتفظ IDs وكميات السلة محليًا؛ بعد التسجيل يدمجها الخادم مع سلة الحساب بحد 10 لكل SKU. لا تحفظ العناوين أو الهاتف في localStorage. الحسابات الإدارية ينشئها Manager عبر خدمة خادم مخولة؛ أول مدير عبر bootstrap محلي موثق وليس رابط تسجيل عام.

## الكتالوج والمخزون

| الجدول | الحقول الأساسية | القيود |
|---|---|---|
| categories | id، slug، name_ar/en، description_ar/en، active، sort_order | slug UNIQUE |
| products | id، slug، brand، name_ar/en، short_description_ar/en، description_ar/en، category_id، gender، family، seasons text[]، occasions text[]، day_night، concentration، longevity_hours_min/max، projection 1..5، status، featured، recommendation_enabled، priority، seo_title_ar/en، seo_description_ar/en | slug UNIQUE؛ status draft/published/archived؛ المحتوى الثنائي والنوتات مطلوبان للنشر |
| product_variants | id، product_id، sku، size_ml، price_minor، compare_at_minor، stock_available، low_stock_threshold، active | SKU UNIQUE؛ size>0؛ price>=0؛ compare_at null أو >=price؛ stock>=0 |
| product_images | id، product_id، storage_path، alt_ar/en، sort_order | path UNIQUE؛ صورة رئيسية بأقل sort_order |
| fragrance_notes | id، slug، name_ar/en | slug UNIQUE |
| product_notes | product_id، note_id، layer | PK(product_id,note_id,layer)، layer top/heart/base |
| product_attributes | product_id، vector jsonb، profile_version | PK product_id؛ مفاتيح قائمة الأبعاد الثابتة فقط، أرقام 0..100 مكتملة |
| inventory_movements | id، variant_id، delta، reason، order_id nullable، actor_id nullable، event_key، created_at | event_key UNIQUE؛ append-only؛ reason initial/order_reserve/cancel_release/return_restock/manual_adjustment |

أضف `version integer default 1` إلى products للتحديث المتفائل؛ كل تعديل منتج أو variants من محرر المنتج يرفعها ذريًا ويقارن expectedVersion. تغيير المخزون أثناء الشراء لا يعتمد على نسخة محرر المنتج، بل على أقفال variants. العملة موحدة على مستوى المتجر، وتوثق في كل order snapshot.

قرار النسخة الأولى: التركيز على مستوى المنتج؛ إذا اختلف تركيب/تركيز العطر ينشأ منتج منفصل، بينما الأحجام variants. `stock_available` هو المتاح للبيع ويُخصم عند إنشاء الطلب، وليس عند التسليم. السلة لا تحجز مخزونًا. الفهرسة: products(status,category_id)، variants(product_id,active)، notes(product_id)، movements(variant_id,created_at). البحث البسيط بأسماء ar/en والبراند مع حد نتائج؛ يضاف pg_trgm عند قياس حاجة فعلية.

## الطلبات والكوبونات

| الجدول | الحقول الأساسية | القيود |
|---|---|---|
| shipping_zones | id، name_ar/en، fee_minor، active | لا رسوم سالبة؛ المنطقة تؤخذ من قائمة الخادم |
| coupons | id، code_normalized، type، value، max_discount_minor nullable، min_subtotal_minor، starts_at، expires_at، total_limit، per_customer_limit، active | code UNIQUE؛ percent 1..100 أو fixed_minor موجب؛ limits>0؛ البداية قبل النهاية |
| orders | id، public_number، user_id، status، cod_status، recipient_name، phone، address_snapshot jsonb، shipping_zone_id، currency_code، currency_exponent، subtotal_minor، discount_minor، shipping_minor، total_minor، coupon_id nullable، coupon_snapshot jsonb nullable، notes، idempotency_key، request_hash، version، collected_at/by nullable، created_at | public_number UNIQUE؛ UNIQUE(user_id,idempotency_key)؛ total=subtotal-discount+shipping؛ payment_method ثابت cod |
| order_items | id، order_id، product_id، variant_id، name_ar/en_snapshot، sku_snapshot، size_ml_snapshot، unit_price_minor، quantity، line_total_minor | quantity 1..10؛ line_total=unit_price*quantity؛ immutable |
| coupon_redemptions | id، coupon_id، order_id، user_id، state | UNIQUE(order_id)، state used/released؛ عدد الاستخدامات يحسب used |
| order_status_history | id، order_id، from_status، to_status، actor_id، reason، created_at | append-only |

الطلب يحتفظ بنسخة الاسم والسعر والعنوان والكوبون والشحن وقت الشراء. لاحقًا لا يغير تعديل المنتج طلبًا قديمًا. الطلب هو سجل تاريخي لا soft cart. `public_number` رقم مقروء للعرض وليس وسيلة تفويض للوصول.

`orders.status`: new/confirmed/preparing/shipped/delivered/cancelled/returned. `cod_status`: uncollected/collected/not_due. لا تغيير مباشر للأعمدة الحرجة عبر Data API. تحديث الحالة عبر RPC فقط بقيمة version متوقعة لتجنب فقد تعديل موظف آخر.

فهرسة: orders(user_id,created_at DESC)، orders(status,created_at)، order_items(order_id)، redemptions(coupon_id,user_id,state)، history(order_id,created_at). لا تخزن عداد استخدام كوبون مستقلًا بلا ضمان؛ قفل سجل الكوبون ثم احسب redemptions لتطبيق الحدود.

## الاختبار والتوصيات

| الجدول | الحقول الأساسية | القيود |
|---|---|---|
| quiz_versions | id، version_number، status، published_at | status draft/published/retired؛ نسخة منشورة حالية واحدة عبر partial unique index |
| quiz_questions | id، quiz_version_id، key، title_ar/en، hint_ar/en، kind، required، sort_order، enabled | UNIQUE(version,key)، kind preference/budget/exclusions |
| quiz_options | id، question_id، label_ar/en، image_path nullable، target_vector jsonb، dimension_weights jsonb، filter_payload jsonb | mappings متحققة حسب نوع السؤال، weights>=0، vector 0..100 |
| quiz_sessions | id، user_id nullable، anonymous_token_hash nullable، quiz_version_id، expires_at، completed_at nullable | مالك واحد: user_id أو anonymous_token_hash |
| quiz_answers | session_id، question_id، option_id | PK(session_id,question_id)؛ trigger/RPC يتحقق أن option يتبع question والنسخة |
| recommendations | id، session_id، profile_snapshot jsonb، algorithm_version، catalog_snapshot_hash، locale، explanation_source، explanation_status، expires_at، created_at | UNIQUE(session_id)، source gemini/fallback؛ profile يشمل الأبعاد والأوزان والثقة |
| recommendation_items | recommendation_id، product_id، variant_id، rank، score، product_profile_snapshot، explanation nullable | PK(recommendation_id,product_id)، UNIQUE(recommendation_id,rank)، score 0..100 |

لا جدول scent_profiles مكرر: `recommendations.profile_snapshot` مصدر Scent DNA، وتُقرأ أحدث نتيجة لعرضها في الحساب. أسعار وتوفر العرض الحالي يقرآن من الكتالوج، والـsnapshot يفسر كيف حُسبت النتيجة تاريخيًا. النسخة المنشورة من الأسئلة immutable؛ تعديل المدير ينسخها إلى draft جديد ثم ينشرها، والجلسات الحالية تكمل النسخة القديمة.

## التشغيل

| الجدول | الغرض والحقول |
|---|---|
| store_settings | صف واحد: الاسم والشعار وhero وaccent والتواصل واللغة الافتراضية والعملة والتوقيت والصوت؛ لا أسرار |
| telegram_settings | صف واحد private: enabled، chat_id، include_customer_details=false افتراضيًا؛ لا token |
| notification_outbox | id، order_id، event_type، status pending/processing/sent/failed، attempts، next_attempt_at، locked_until، telegram_message_id، last_error_code، sent_at؛ UNIQUE(order_id,event_type) |
| audit_logs | actor_id، action، entity_type/id، safe_metadata، created_at؛ append-only بلا أسرار أو عناوين كاملة |
| rate_limit_buckets | bucket_key، window_start، count، expires_at؛ PK(bucket_key,window_start)، increments ذرية وcleanup |

احتفظ بجداول التشغيل في schema `private` غير مكشوف. worker يصل عبر RPC مقيد بالخادم. لا تخزن bot token في telegram_settings؛ يوضع في إعدادات البيئة فقط. جداول الصور ومحتوى الأسئلة لا تسمح بحقن HTML خام.

## المعاملات المطلوبة

1. `place_order`: مستخدم موثق؛ قفل مفتاح العملية لمنع تكرار متزامن؛ قفل variants بترتيب id ثابت ثم coupon؛ تحقق وتسعير وكتابة جميع السجلات أو rollback كامل.
2. `transition_order`: قفل order ثم variants مرتبة عند الإلغاء؛ تحقق actor والدور والحالة والنسخة؛ أعد المخزون واستخدام الكوبون مرة واحدة قبل الشحن فقط.
3. `adjust_inventory`: inventory_manager أو manager؛ سبب إلزامي، delta صحيح، منع سالب، event_key لمنع التكرار.
4. `publish_quiz`: manager؛ تحقق الترجمة والأبعاد والأسئلة وتمثيل التفضيلات ثم تبديل النسخة الحالية ذريًا.
5. `claim_notifications`: worker فقط؛ `FOR UPDATE SKIP LOCKED` مع lease، دفعات صغيرة ومحاولات محدودة.

التفاصيل الحسابية في [BACKEND](BACKEND.md). أنشئ RPC عامة ضيقة `SECURITY INVOKER` تستدعي دوال خاصة عند الحاجة، مع تحقق هوية وصلاحية داخل الدالة الخاصة. revoke EXECUTE من PUBLIC وanon على وظائف الشراء والإدارة؛ grant authenticated للمداخل اللازمة فقط. دوال worker تقبل server secret فقط. كل SECURITY DEFINER له search_path فارغ وأسماء جداول مؤهلة ومالك أقل صلاحية، ولا يمكن تمرير actor_id لتجاوز auth.uid.

## سياسة الوصول

RLS مفعّلة على كل جدول exposed، مع GRANT محدود أيضًا. anon يقرأ المنشور فقط ومحتوى الاختبار الحالي؛ القراءة العامة للكتالوج تعرض boolean in_stock دون الكمية الدقيقة. قراءة الكتالوج عبر RPC ضيقة ترجع الأعمدة العامة المحددة وin_stock فقط وتفلتر published، ولا تمنح anon SELECT على stock_available. إذا احتاجت صلاحية مرتفعة فتنفذ بمنطق ثابت دون dynamic SQL وبأقل امتياز، وتختبر لمنع تسريب drafts أو الكميات. الـviews الأخرى تستخدم security_invoker؛ لا تستخدم view عامة ذات bypass غير مقصود.

العميل يقرأ/يعدل ملفه غير الإداري وسلته ومفضلته فقط، ويقرأ طلباته وبنودها دون تعديلها. Staff inventory لا يقرأ orders أو profiles العملاء. Staff orders يقرأ الطلبات ومعلومات التنفيذ اللازمة والكتالوج دون الكتابة إلى المخزون. Manager يدير عبر خدمات محمية. لا expose للـoutbox/audit/rate limits أو staff_roles write للعامة.

جلسات الاختبار المجهولة يملكها token عشوائي 256-bit داخل cookie HttpOnly Secure SameSite=Lax؛ المخزن hash فقط. القراءة والكتابة تمر عبر الخادم لا RLS عامة مجهولة. عند الدخول تُنقل الملكية بعد إثبات token. UPDATE policies تستخدم USING وWITH CHECK، واختبار مباشر لـREST/RPC مطلوب لمنع تجاوز الواجهة.

## البيانات الأولية والترحيل

ترتيب التنفيذ: أنواع وprofiles/staff → catalog/inventory → cart/favorites/shipping/coupons → orders/history → quiz/results → operational tables → indexes/policies/functions → seed. migrations تُنشأ وتُراجع وتُختبر محليًا. Seed ديمو مستقل idempotent بــslugs ثابتة لا يضيف حسابات بكلمات مرور معروفة. البيانات الغنية والسيناريوهات في [DEMO_RUNBOOK](DEMO_RUNBOOK.md).
